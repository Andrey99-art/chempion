// src/pages/PaymentsPage.tsx
//
// Страница всех оплат с фильтрами по периоду.
// Показывает таблицу оплат и итоговую сумму за выбранный период.

import { useCallback, useEffect, useState } from "react";
import { getPayments, getPaymentsTotal, exportPayments } from "../lib/tauri";
import { formatDateShort, formatMoney } from "../lib/formatters";
import { useUIStore } from "../store/uiStore";
import type { Payment } from "../types";
import { Download } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";


export default function PaymentsPage() {
  const addNotification = useUIStore((state) => state.addNotification);

  const [payments, setPayments] = useState<readonly Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Фильтры: по умолчанию — текущий месяц
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const [paymentsData, totalData] = await Promise.all([
        getPayments({
          date_from: dateFrom || null,
          date_to: dateTo || null,
          client_id: null,
          page: 1,
          per_page: 200,
        }),
        getPaymentsTotal(dateFrom || null, dateTo || null),
      ]);
      setPayments(paymentsData);
      setTotal(totalData);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка загрузки оплат";
      addNotification("error", message);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, addNotification]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleExportPayments = async () => {
    try {
      const path = await save({
        defaultPath: "payments.xlsx",
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      if (!path) return;
      const result = await exportPayments(path, dateFrom || null, dateTo || null);
      addNotification("success", result);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка экспорта";
      addNotification("error", message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Оплаты</h1>
        <div className="flex items-center gap-4">
          <p className="text-lg font-semibold text-slate-900">
            Итого: {formatMoney(total)}
          </p>
          <button
            type="button"
            onClick={handleExportPayments}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Экспорт
          </button>
        </div>
      </div>

      {/* Фильтры по дате */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="date-from" className="mb-1 block text-xs font-medium text-slate-600">
            С
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label htmlFor="date-to" className="mb-1 block text-xs font-medium text-slate-600">
            По
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Таблица */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Дата
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Клиент
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Сумма
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Описание
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Принял
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <PaymentsTableBody isLoading={isLoading} payments={payments} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Тело таблицы — вынесено для избежания вложенных тернарников */
function PaymentsTableBody({
  isLoading,
  payments,
}: {
  readonly isLoading: boolean;
  readonly payments: readonly Payment[];
}) {
  if (isLoading) {
    return (
      <tr>
        <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
          Загрузка...
        </td>
      </tr>
    );
  }

  if (payments.length === 0) {
    return (
      <tr>
        <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
          Оплат за выбранный период нет
        </td>
      </tr>
    );
  }

  return (
    <>
      {payments.map((payment) => (
        <tr key={payment.id}>
          <td className="px-4 py-3 text-sm text-slate-600">
            {formatDateShort(payment.payment_date)}
          </td>
          <td className="px-4 py-3 text-sm font-medium text-slate-900">
            {payment.client_name}
          </td>
          <td className="px-4 py-3 text-sm font-medium text-slate-900">
            {formatMoney(payment.amount)}
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
            {payment.description ?? "—"}
          </td>
          <td className="px-4 py-3 text-sm text-slate-500">
            {payment.received_by_name ?? "—"}
          </td>
        </tr>
      ))}
    </>
  );
}