// src/pages/VisitsPage.tsx
//
// Страница быстрой регистрации посещений.
// Поиск клиента → клик → отмечен. Список посещений за сегодня.

import { useCallback, useEffect, useState } from "react";
import { Clock, LogOut, Search, UserCheck } from "lucide-react";
import {
  searchClientsQuick,
  createVisit,
  getTodayVisits,
  checkoutVisit,
} from "../lib/tauri";
import { formatFullName, formatPhone } from "../lib/formatters";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import SubscriptionBadge from "../components/SubscriptionBadge";
import type { ClientListItem, Visit } from "../types";

export default function VisitsPage() {
  const user = useAuthStore((state) => state.user);
  const addNotification = useUIStore((state) => state.addNotification);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<readonly ClientListItem[]>([]);
  const [todayVisits, setTodayVisits] = useState<readonly Visit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingVisits, setIsLoadingVisits] = useState(true);

  // Загрузка посещений за сегодня
  const loadTodayVisits = useCallback(async () => {
    try {
      const visits = await getTodayVisits();
      setTodayVisits(visits);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка загрузки посещений";
      addNotification("error", message);
    } finally {
      setIsLoadingVisits(false);
    }
  }, [addNotification]);

  useEffect(() => {
    loadTodayVisits();
  }, [loadTodayVisits]);

  // Поиск клиентов с debounce
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchClientsQuick(trimmed);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Отметить посещение
  const handleCheckIn = async (clientId: number) => {
    try {
      const visit = await createVisit({ client_id: clientId }, user?.id ?? 0);
      addNotification("success", `${visit.client_name} отмечен(а)`);
      setSearchQuery("");
      setSearchResults([]);
      await loadTodayVisits();
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка отметки";
      addNotification("error", message);
    }
  };

  // Отметить уход
  const handleCheckOut = async (visitId: number) => {
    try {
      await checkoutVisit(visitId);
      addNotification("success", "Уход отмечен");
      await loadTodayVisits();
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка";
      addNotification("error", message);
    }
  };

  return (
    <div className="space-y-6">
      {/* --- Поиск клиента --- */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Отметить посещение</h2>

        {/* Большое поле поиска */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Начните вводить фамилию или имя клиента..."
            autoFocus
            className="w-full rounded-xl border border-slate-300 py-4 pl-12 pr-4 text-lg text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Результаты поиска */}
        {searchQuery.trim().length > 0 && (
          <div className="mt-3 space-y-1">
            <SearchResultsContent
              isSearching={isSearching}
              results={searchResults}
              onCheckIn={handleCheckIn}
            />
          </div>
        )}
      </div>

      {/* --- Посещения за сегодня --- */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Сегодня</h2>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
            {todayVisits.length}
          </span>
        </div>

        <TodayVisitsContent
          isLoading={isLoadingVisits}
          visits={todayVisits}
          onCheckOut={handleCheckOut}
        />
      </div>
    </div>
  );
}

/** Содержимое блока результатов поиска — вынесено для избежания вложенных тернарников */
function SearchResultsContent({
  isSearching,
  results,
  onCheckIn,
}: {
  readonly isSearching: boolean;
  readonly results: readonly ClientListItem[];
  readonly onCheckIn: (clientId: number) => void;
}) {
  if (isSearching) {
    return <p className="py-4 text-center text-sm text-slate-400">Поиск...</p>;
  }

  if (results.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">Никого не найдено</p>;
  }

  return (
    <>
      {results.map((client) => (
        <button
          key={client.id}
          type="button"
          onClick={() => onCheckIn(client.id)}
          className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition hover:bg-blue-50"
        >
          <div>
            <p className="text-base font-medium text-slate-900">
              {formatFullName(client.last_name, client.first_name, client.middle_name)}
            </p>
            <p className="text-sm text-slate-500">{formatPhone(client.phone)}</p>
          </div>
          <div className="flex items-center gap-3">
            <SubscriptionBadge
              status={client.subscription_status}
              endDate={client.subscription_end_date}
            />
            <span className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white">
              Отметить
            </span>
          </div>
        </button>
      ))}
    </>
  );
}

/** Содержимое блока посещений за сегодня — вынесено для избежания вложенных тернарников */
function TodayVisitsContent({
  isLoading,
  visits,
  onCheckOut,
}: {
  readonly isLoading: boolean;
  readonly visits: readonly Visit[];
  readonly onCheckOut: (visitId: number) => void;
}) {
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>;
  }

  if (visits.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Пока никто не пришёл</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {visits.map((visit) => (
        <div
          key={visit.id}
          className="flex items-center justify-between py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{visit.client_name}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                {visit.check_in_time}
                {visit.check_out_time && ` — ${visit.check_out_time}`}
              </p>
            </div>
          </div>

          {!visit.check_out_time && (
            <button
              type="button"
              onClick={() => onCheckOut(visit.id)}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Уход
            </button>
          )}
        </div>
      ))}
    </div>
  );
}