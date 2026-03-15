// src/components/PaymentsTab.tsx
//
// Вкладка "Оплаты" в карточке клиента.
// Показывает историю оплат и позволяет добавить новую.

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getClientPayments, createPayment } from "../lib/tauri";
import { formatDateShort, formatMoney } from "../lib/formatters";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import type { Payment } from "../types";

interface PaymentsTabProps {
  readonly clientId: number;
}

export default function PaymentsTab({ clientId }: PaymentsTabProps) {
  const user = useAuthStore((state) => state.user);
  const addNotification = useUIStore((state) => state.addNotification);

  const [payments, setPayments] = useState<readonly Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Состояние формы
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Загрузка оплат
  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getClientPayments(clientId);
      setPayments(data);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка загрузки оплат";
      addNotification("error", message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, addNotification]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Подсчёт общей суммы
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  // Создание оплаты
  const handleCreate = async () => {
    const parsedAmount = Number.parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      addNotification("warning", "Введите корректную сумму");
      return;
    }

    setIsSubmitting(true);
    try {
      await createPayment(
        {
          client_id: clientId,
          subscription_id: null,
          amount: parsedAmount,
          payment_date: paymentDate,
          description: description.trim() || null,
        },
        user?.id ?? 0,
      );
      addNotification("success", "Оплата записана");
      setShowForm(false);
      setAmount("");
      setDescription("");
      await loadPayments();
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка записи оплаты";
      addNotification("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Верхняя панель: итого + кнопка */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Всего оплат: <span className="font-semibold text-slate-900">{formatMoney(totalAmount)}</span>
        </p>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Новая оплата
        </button>
      </div>

      {/* Форма создания */}
      {showForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Новая оплата</h4>
          <div className="flex flex-wrap items-end gap-3">
            {/* Сумма */}
            <div>
              <label htmlFor="pay-amount" className="mb-1 block text-xs font-medium text-slate-600">
                Сумма (BYN)
              </label>
              <input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Дата */}
            <div>
              <label htmlFor="pay-date" className="mb-1 block text-xs font-medium text-slate-600">
                Дата
              </label>
              <input
                id="pay-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Описание */}
            <div className="min-w-48 flex-1">
              <label htmlFor="pay-desc" className="mb-1 block text-xs font-medium text-slate-600">
                Описание
              </label>
              <input
                id="pay-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="За что оплата..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Кнопки */}
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? "Сохранение..." : "Записать"}
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

      {/* Таблица оплат */}
      {payments.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Оплат пока нет</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Дата
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Сумма
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Описание
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Принял
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-2.5 text-sm text-slate-600">
                    {formatDateShort(payment.payment_date)}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                    {formatMoney(payment.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-600">
                    {payment.description ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-500">
                    {payment.received_by_name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}