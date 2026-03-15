// src/components/SubscriptionsTab.tsx
//
// Вкладка "Абонементы" в карточке клиента.
// Показывает историю абонементов и позволяет создать новый.

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  getClientSubscriptions,
  getSubscriptionTypes,
  createSubscription,
} from "../lib/tauri";
import { formatDateShort } from "../lib/formatters";
import { useUIStore } from "../store/uiStore";
import SubscriptionBadge from "./SubscriptionBadge";
import type { Subscription, SubscriptionType } from "../types";

interface SubscriptionsTabProps {
  readonly clientId: number;
}

export default function SubscriptionsTab({ clientId }: SubscriptionsTabProps) {
  const addNotification = useUIStore((state) => state.addNotification);

  const [subscriptions, setSubscriptions] = useState<readonly Subscription[]>([]);
  const [types, setTypes] = useState<readonly SubscriptionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Состояние формы создания абонемента
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(() => {
    // По умолчанию — сегодняшняя дата
    return new Date().toISOString().split("T")[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Загрузка абонементов клиента
  const loadSubscriptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const subs = await getClientSubscriptions(clientId);
      setSubscriptions(subs);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка загрузки абонементов";
      addNotification("error", message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, addNotification]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  // Загрузка типов абонементов (для формы)
  useEffect(() => {
    getSubscriptionTypes()
      .then(setTypes)
      .catch(() => {});
  }, []);

  // Создание абонемента
  const handleCreate = async () => {
    if (!selectedTypeId) {
      addNotification("warning", "Выберите тип абонемента");
      return;
    }

    setIsSubmitting(true);
    try {
      await createSubscription({
        client_id: clientId,
        type_id: selectedTypeId,
        start_date: startDate,
      });
      addNotification("success", "Абонемент создан");
      setShowForm(false);
      setSelectedTypeId(null);
      await loadSubscriptions();
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка создания абонемента";
      addNotification("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Цена выбранного типа (для отображения)
  const selectedType = types.find((t) => t.id === selectedTypeId);

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Кнопка "Новый абонемент" */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Новый абонемент
        </button>
      </div>

      {/* Форма создания (показывается по кнопке) */}
      {showForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Новый абонемент</h4>
          <div className="flex flex-wrap items-end gap-3">
            {/* Тип абонемента */}
            <div className="min-w-48 flex-1">
              <label htmlFor="sub-type" className="mb-1 block text-xs font-medium text-slate-600">
                Тип абонемента
              </label>
              <select
                id="sub-type"
                value={selectedTypeId ?? ""}
                onChange={(e) => setSelectedTypeId(e.target.value ? Number(e.target.value) : null)}
                aria-label="Тип абонемента"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Выберите тип</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} — {type.price.toFixed(2)} BYN
                    {type.duration_days ? ` (${type.duration_days} дн.)` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Дата начала */}
            <div>
              <label htmlFor="sub-start" className="mb-1 block text-xs font-medium text-slate-600">
                Дата начала
              </label>
              <input
                id="sub-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Цена (информационно) */}
            {selectedType && (
              <p className="pb-2 text-sm font-medium text-slate-700">
                {selectedType.price.toFixed(2)} BYN
              </p>
            )}

            {/* Кнопки */}
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? "Создание..." : "Создать"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список абонементов */}
      {subscriptions.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Абонементов пока нет</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{sub.type_name}</p>
                <p className="text-xs text-slate-500">
                  {formatDateShort(sub.start_date)} — {formatDateShort(sub.end_date)}
                </p>
              </div>
              <SubscriptionBadge status={sub.status} endDate={sub.end_date} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}