// src/components/ClientQuickEdit.tsx
//
// Выдвижная панель справа для быстрого редактирования клиента.
// Открывается при клике на строку в таблице клиентов.
// Позволяет изменить основные поля без перехода на отдельную страницу.

import { useEffect, useState } from "react";
import { X, ExternalLink, Save, Loader2 } from "lucide-react";
import { getClient, updateClient, getTrainers } from "../lib/tauri";
import { formatDate, formatPhone } from "../lib/formatters";
import { useUIStore } from "../store/uiStore";
import SubscriptionBadge from "./SubscriptionBadge";
import type { Client, User } from "../types";

interface ClientQuickEditProps {
  /** ID выбранного клиента (null = панель закрыта) */
  readonly clientId: number | null;
  /** Закрыть панель */
  readonly onClose: () => void;
  /** Перейти к полной карточке */
  readonly onOpenDetail: (clientId: number) => void;
  /** Перейти к редактированию (полная форма) */
  readonly onEdit: (clientId: number) => void;
  /** Вызывается после сохранения (чтобы обновить таблицу) */
  readonly onSaved: () => void;
}

export default function ClientQuickEdit({
  clientId,
  onClose,
  onOpenDetail,
  onEdit,
  onSaved,
}: ClientQuickEditProps) {
  const addNotification = useUIStore((state) => state.addNotification);

  const [client, setClient] = useState<Client | null>(null);
  const [trainers, setTrainers] = useState<readonly User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Редактируемые поля
  const [phone, setPhone] = useState("");
  const [trainerId, setTrainerId] = useState<number | null>(null);
  const [medicalNotes, setMedicalNotes] = useState("");
  const [notes, setNotes] = useState("");

  // Загрузка клиента при смене clientId
  useEffect(() => {
    if (!clientId) {
      setClient(null);
      return;
    }

    setIsLoading(true);
    Promise.all([
      getClient(clientId),
      getTrainers(),
    ])
      .then(([clientData, trainersData]) => {
        setClient(clientData);
        setTrainers(trainersData);
        // Заполняем поля формы
        setPhone(clientData.phone ?? "");
        setTrainerId(clientData.trainer_id);
        setMedicalNotes(clientData.medical_notes ?? "");
        setNotes(clientData.notes ?? "");
      })
      .catch((err) => {
        const message = typeof err === "string" ? err : "Ошибка загрузки";
        addNotification("error", message);
      })
      .finally(() => setIsLoading(false));
  }, [clientId, addNotification]);

  // Сохранение изменений
  const handleSave = async () => {
    if (!client) return;

    setIsSaving(true);
    try {
      await updateClient(client.id, {
        last_name: client.last_name,
        first_name: client.first_name,
        middle_name: client.middle_name || null,
        phone: phone.trim() || null,
        birth_date: client.birth_date || null,
        trainer_id: trainerId,
        medical_notes: medicalNotes.trim() || null,
        notes: notes.trim() || null,
      });
      addNotification("success", "Данные сохранены");
      onSaved();
      // Перезагружаем данные клиента
      const updated = await getClient(client.id);
      setClient(updated);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка сохранения";
      addNotification("error", message);
    } finally {
      setIsSaving(false);
    }
  };

  // Закрытие по Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Если нет clientId — панель скрыта
  if (!clientId) return null;

  return (
    <>
      {/* Затемняющий фон */}
      <div
        className="fixed inset-0 z-40 bg-black/20 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Панель справа */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-96 flex-col border-l border-slate-200 bg-white shadow-xl">
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Быстрое редактирование</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Закрыть панель"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Содержимое */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : client ? (
            <QuickEditForm
              client={client}
              trainers={trainers}
              phone={phone}
              onPhoneChange={setPhone}
              trainerId={trainerId}
              onTrainerIdChange={setTrainerId}
              medicalNotes={medicalNotes}
              onMedicalNotesChange={setMedicalNotes}
              notes={notes}
              onNotesChange={setNotes}
            />
          ) : (
            <p className="text-center text-sm text-slate-400">Клиент не найден</p>
          )}
        </div>

        {/* Нижняя панель с кнопками */}
        {client && (
          <div className="border-t border-slate-200 p-4">
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenDetail(client.id)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Карточка
              </button>
              <button
                type="button"
                onClick={() => onEdit(client.id)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                Полная форма
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Форма с полями — вынесена для снижения Cognitive Complexity */
function QuickEditForm({
  client,
  trainers,
  phone,
  onPhoneChange,
  trainerId,
  onTrainerIdChange,
  medicalNotes,
  onMedicalNotesChange,
  notes,
  onNotesChange,
}: {
  readonly client: Client;
  readonly trainers: readonly User[];
  readonly phone: string;
  readonly onPhoneChange: (val: string) => void;
  readonly trainerId: number | null;
  readonly onTrainerIdChange: (val: number | null) => void;
  readonly medicalNotes: string;
  readonly onMedicalNotesChange: (val: string) => void;
  readonly notes: string;
  readonly onNotesChange: (val: string) => void;
}) {
  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="space-y-4">
      {/* ФИО (не редактируемое — только в полной форме) */}
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-lg font-semibold text-slate-900">
          {client.last_name} {client.first_name}
        </p>
        {client.middle_name && (
          <p className="text-sm text-slate-500">{client.middle_name}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <SubscriptionBadge status={null} />
        </div>
        {client.birth_date && (
          <p className="mt-1 text-xs text-slate-400">
            Дата рождения: {formatDate(client.birth_date)}
          </p>
        )}
        <p className="text-xs text-slate-400">
          В системе с {formatDate(client.created_at)}
        </p>
      </div>

      {/* Телефон */}
      <div>
        <label htmlFor="qe-phone" className="mb-1 block text-xs font-medium text-slate-600">
          Телефон
        </label>
        <input
          id="qe-phone"
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="+375 (29) 123-45-67"
          className={inputClass}
        />
      </div>

      {/* Тренер */}
      <div>
        <label htmlFor="qe-trainer" className="mb-1 block text-xs font-medium text-slate-600">
          Тренер
        </label>
        <select
          id="qe-trainer"
          value={trainerId ?? ""}
          onChange={(e) => onTrainerIdChange(e.target.value ? Number(e.target.value) : null)}
          aria-label="Выбор тренера"
          className={inputClass}
        >
          <option value="">Без тренера</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      </div>

      {/* Медицинские заметки */}
      <div>
        <label htmlFor="qe-medical" className="mb-1 block text-xs font-medium text-slate-600">
          Медицинские ограничения
        </label>
        <textarea
          id="qe-medical"
          rows={2}
          value={medicalNotes}
          onChange={(e) => onMedicalNotesChange(e.target.value)}
          placeholder="Противопоказания..."
          className={inputClass}
        />
      </div>

      {/* Заметки */}
      <div>
        <label htmlFor="qe-notes" className="mb-1 block text-xs font-medium text-slate-600">
          Заметки
        </label>
        <textarea
          id="qe-notes"
          rows={2}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Любые заметки..."
          className={inputClass}
        />
      </div>
    </div>
  );
}