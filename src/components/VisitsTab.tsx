// src/components/VisitsTab.tsx
//
// Вкладка "Посещения" в карточке клиента.
// Показывает историю посещений и общую статистику.

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Clock } from "lucide-react";
import { getClientVisits } from "../lib/tauri";
import { formatDateShort } from "../lib/formatters";
import { useUIStore } from "../store/uiStore";
import type { Visit } from "../types";

interface VisitsTabProps {
  readonly clientId: number;
}

export default function VisitsTab({ clientId }: VisitsTabProps) {
  const addNotification = useUIStore((state) => state.addNotification);

  const [visits, setVisits] = useState<readonly Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadVisits = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getClientVisits(clientId, 100);
      setVisits(data);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка загрузки посещений";
      addNotification("error", message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, addNotification]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>;
  }

  // Статистика
  const totalVisits = visits.length;
  const thisMonthVisits = visits.filter((v) => {
    const now = new Date();
    const visitDate = new Date(v.visit_date);
    return visitDate.getMonth() === now.getMonth() && visitDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="flex gap-4">
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-2xl font-bold text-slate-900">{totalVisits}</p>
          <p className="text-xs text-slate-500">Всего посещений</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-2xl font-bold text-slate-900">{thisMonthVisits}</p>
          <p className="text-xs text-slate-500">В этом месяце</p>
        </div>
      </div>

      {/* Список посещений */}
      {visits.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Посещений пока нет</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {visits.map((visit) => (
            <div
              key={visit.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                  <CalendarCheck className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {formatDateShort(visit.visit_date)}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    {visit.check_in_time}
                    {visit.check_out_time && ` — ${visit.check_out_time}`}
                  </p>
                </div>
              </div>
              {visit.registered_by_name && (
                <p className="text-xs text-slate-400">
                  Отметил: {visit.registered_by_name}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}