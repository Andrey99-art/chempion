// src/pages/DashboardPage.tsx
//
// Главный экран приложения (дашборд).
// Карточки-счётчики, уведомления об истекающих абонементах,
// график посещений за 30 дней, быстрые действия.

import { useEffect, useState } from "react";
import {
  Users,
  CreditCard,
  CalendarCheck,
  TrendingUp,
  AlertTriangle,
  UserPlus,
  Clock,
} from "lucide-react";
import { getDashboardData, getVisitStats } from "../lib/tauri";
import { formatMoney, formatDateShort } from "../lib/formatters";
import { useUIStore } from "../store/uiStore";
import type { DashboardData, VisitStats } from "../types";

interface DashboardPageProps {
  readonly onNavigate: (page: string) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const addNotification = useUIStore((state) => state.addNotification);

  const [data, setData] = useState<DashboardData | null>(null);
  const [visitStats, setVisitStats] = useState<readonly VisitStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const dashboard = await getDashboardData(7);
        setData(dashboard);

        // Статистика посещений за последние 30 дней
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const dateTo = today.toISOString().split("T")[0];
        const dateFrom = thirtyDaysAgo.toISOString().split("T")[0];

        const stats = await getVisitStats(dateFrom, dateTo);
        setVisitStats(stats);
      } catch (err) {
        const message = typeof err === "string" ? err : "Ошибка загрузки данных";
        addNotification("error", message);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [addNotification]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-400">Загрузка...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-400">Не удалось загрузить данные</p>
      </div>
    );
  }

  // Максимальное значение для графика
  const maxVisits = Math.max(1, ...visitStats.map((s) => s.count));

  return (
    <div className="space-y-6">
      {/* --- Карточки-счётчики --- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-blue-100 text-blue-600"
          label="Всего клиентов"
          value={String(data.total_clients)}
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5" />}
          iconBg="bg-green-100 text-green-600"
          label="Активных абонементов"
          value={String(data.active_subscriptions)}
        />
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          iconBg="bg-purple-100 text-purple-600"
          label="Посещений сегодня"
          value={String(data.visits_today)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="bg-amber-100 text-amber-600"
          label="Доход за месяц"
          value={formatMoney(data.revenue_this_month)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* --- График посещений --- */}
        <div className="col-span-1 rounded-xl bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Посещения за 30 дней</h3>
          <VisitsChart stats={visitStats} maxVisits={maxVisits} />
        </div>

        {/* --- Быстрые действия --- */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Быстрые действия</h3>
          <div className="space-y-2">
            <QuickAction
              icon={<CalendarCheck className="h-4 w-4" />}
              label="Отметить посещение"
              onClick={() => onNavigate("visits")}
            />
            <QuickAction
              icon={<UserPlus className="h-4 w-4" />}
              label="Новый клиент"
              onClick={() => onNavigate("client-form")}
            />
            <QuickAction
              icon={<CreditCard className="h-4 w-4" />}
              label="Все оплаты"
              onClick={() => onNavigate("payments")}
            />
          </div>
        </div>
      </div>

      {/* --- Уведомления об истекающих абонементах --- */}
      <ExpiringPanel
        expiring={data.expiring_soon}
        onNavigate={onNavigate}
      />
    </div>
  );
}

// === Карточка-счётчик ===

function StatCard({
  icon,
  iconBg,
  label,
  value,
}: {
  readonly icon: React.ReactNode;
  readonly iconBg: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// === Простой столбчатый график посещений (CSS-based, без Recharts) ===

function VisitsChart({
  stats,
  maxVisits,
}: {
  readonly stats: readonly VisitStats[];
  readonly maxVisits: number;
}) {
  if (stats.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Нет данных о посещениях</p>;
  }

  return (
    <div className="flex h-48 items-end gap-1">
      {stats.map((s) => {
        const heightPercent = (s.count / maxVisits) * 100;
        return (
          <div
            key={s.date}
            className="group relative flex-1"
            title={`${s.date}: ${s.count}`}
          >
            <div
              className="mx-auto w-full max-w-3 rounded-t bg-blue-500 transition group-hover:bg-blue-600"
              style={{ height: `${Math.max(heightPercent, 2)}%` }}
            />
            {/* Tooltip при наведении */}
            <div className="absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-xs text-white group-hover:block">
              {s.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// === Кнопка быстрого действия ===

function QuickAction({
  icon,
  label,
  onClick,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <span className="text-slate-400">{icon}</span>
      {label}
    </button>
  );
}

// === Панель уведомлений об истекающих абонементах ===

function ExpiringPanel({
  expiring,
  onNavigate,
}: {
  readonly expiring: readonly import("../types").ExpiringSubscription[];
  readonly onNavigate: (page: string, id?: number) => void;
}) {
  if (expiring.length === 0) return null;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h3 className="text-sm font-semibold text-slate-700">
          Требуют внимания ({expiring.length})
        </h3>
      </div>
      <div className="divide-y divide-slate-100">
        {expiring.map((item) => (
          <button
            key={`${item.client_id}-${item.end_date}`}
            type="button"
            onClick={() => onNavigate("client-detail", item.client_id)}
            className="flex w-full items-center justify-between py-3 text-left transition hover:bg-slate-50"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{item.client_name}</p>
              <p className="text-xs text-slate-500">{item.subscription_type}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">до {formatDateShort(item.end_date)}</p>
              <ExpiringBadge daysLeft={item.days_left} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// === Бейдж дней до истечения ===

function ExpiringBadge({ daysLeft }: { readonly daysLeft: number }) {
  if (daysLeft <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
        <Clock className="h-3 w-3" />
        ИСТЁК
      </span>
    );
  }
  if (daysLeft <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
        <Clock className="h-3 w-3" />
        {daysLeft} дн.
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
      <Clock className="h-3 w-3" />
      {daysLeft} дн.
    </span>
  );
}