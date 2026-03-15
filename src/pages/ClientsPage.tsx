// src/pages/ClientsPage.tsx
//
// Страница списка клиентов — главная рабочая страница администратора.
// Таблица с поиском (FTS5), фильтрами по статусу/тренеру, пагинацией.

import { useCallback, useEffect, useState } from "react";
import { UserPlus, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { getClients, getTrainers, exportClients } from "../lib/tauri";
import { save } from "@tauri-apps/plugin-dialog";
import { formatDateShort, formatPhone, formatFullName } from "../lib/formatters";
import SearchBar from "../components/SearchBar";
import SubscriptionBadge from "../components/SubscriptionBadge";
import { useUIStore } from "../store/uiStore";
import type { ClientListItem, User } from "../types";
import ClientQuickEdit from "../components/ClientQuickEdit";

interface ClientsPageProps {
  readonly onNavigate: (page: string, clientId?: number) => void;
}

/** Содержимое тела таблицы — вынесено для снижения Cognitive Complexity */
function ClientTableBody({
  isLoading,
  clients,
  search,
  onRowClick,
}: {
  readonly isLoading: boolean;
  readonly clients: readonly ClientListItem[];
  readonly search: string;
  readonly onRowClick: (id: number) => void;
}) {
  if (isLoading) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
          Загрузка...
        </td>
      </tr>
    );
  }

  if (clients.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
          {search ? "Ничего не найдено" : "Клиентов пока нет"}
        </td>
      </tr>
    );
  }

  return (
    <>
      {clients.map((client) => (
        <tr
          key={client.id}
          onClick={() => onRowClick(client.id)}
          className={`cursor-pointer transition hover:bg-slate-50 ${
            client.is_active ? "" : "opacity-50"
          }`}
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                {client.last_name.charAt(0)}{client.first_name.charAt(0)}
              </div>
              <span className="text-sm font-medium text-slate-900">
                {formatFullName(client.last_name, client.first_name, client.middle_name)}
              </span>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
            {formatPhone(client.phone)}
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
            {client.trainer_name ?? "—"}
          </td>
          <td className="px-4 py-3">
            <SubscriptionBadge
              status={client.subscription_status}
              endDate={client.subscription_end_date}
            />
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
            {formatDateShort(client.subscription_end_date)}
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
            {formatDateShort(client.last_visit_date)}
          </td>
        </tr>
      ))}
    </>
  );
}

export default function ClientsPage({ onNavigate }: ClientsPageProps) {
  const addNotification = useUIStore((state) => state.addNotification);

  // --- Состояние ---
  const [clients, setClients] = useState<readonly ClientListItem[]>([]);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Фильтры
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [trainerFilter, setTrainerFilter] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Пагинация
  const [page, setPage] = useState(1);
  const perPage = 50;

  // Быстрое редактирование
  const [quickEditClientId, setQuickEditClientId] = useState<number | null>(null);

  // --- Загрузка данных ---
  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getClients({
        search: search || null,
        trainer_id: trainerFilter,
        subscription_status: statusFilter,
        is_active: showInactive ? null : true,
        page,
        per_page: perPage,
      });
      setClients(response.clients);
      setTotal(response.total);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка загрузки клиентов";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, trainerFilter, showInactive, page]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    getTrainers()
      .then(setTrainers)
      .catch(() => {});
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value || null);
    setPage(1);
  };

  const handleTrainerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setTrainerFilter(val ? Number(val) : null);
    setPage(1);
  };

const handleRowClick = (clientId: number) => {
    setQuickEditClientId(clientId);
  };

  const handleExport = async () => {
    try {
      const path = await save({
        defaultPath: "clients.xlsx",
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      if (!path) return;
      const result = await exportClients(path, showInactive);
      addNotification("success", result);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка экспорта";
      addNotification("error", message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-4">
      {/* --- Верхняя панель: заголовок + кнопки --- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Клиенты</h1>
          <p className="text-sm text-slate-500">
            Всего: {total}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Экспорт
          </button>
          <button
            type="button"
            onClick={() => onNavigate("client-form")}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Добавить клиента
          </button>
        </div>
      </div>

      {/* --- Панель фильтров --- */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div className="min-w-64 flex-1">
          <SearchBar
            value={search}
            onChange={handleSearchChange}
            autoFocus
          />
        </div>

        <select
          value={statusFilter ?? ""}
          onChange={handleStatusChange}
          aria-label="Фильтр по статусу абонемента"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Все статусы</option>
          <option value="active">Активный</option>
          <option value="expired">Истёк</option>
          <option value="none">Без абонемента</option>
        </select>

        <select
          value={trainerFilter ?? ""}
          onChange={handleTrainerChange}
          aria-label="Фильтр по тренеру"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Все тренеры</option>
          {trainers.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.full_name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => {
              setShowInactive(e.target.checked);
              setPage(1);
            }}
            className="rounded border-slate-300"
          />{" "}
          Показать неактивных
        </label>
      </div>

      {/* --- Сообщение об ошибке --- */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* --- Таблица клиентов --- */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ФИО
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Телефон
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Тренер
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Абонемент
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  До
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Последний визит
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <ClientTableBody
                isLoading={isLoading}
                clients={clients}
                search={search}
                onRowClick={handleRowClick}
              />
            </tbody>
          </table>
        </div>

        {/* --- Пагинация --- */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-500">
              Страница {page} из {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Назад
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Далее
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Панель быстрого редактирования */}
      <ClientQuickEdit
        clientId={quickEditClientId}
        onClose={() => setQuickEditClientId(null)}
        onOpenDetail={(id) => {
          setQuickEditClientId(null);
          onNavigate("client-detail", id);
        }}
        onEdit={(id) => {
          setQuickEditClientId(null);
          onNavigate("client-form", id);
        }}
        onSaved={loadClients}
      />
    </div>
  );
}