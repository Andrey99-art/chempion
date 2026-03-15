// src/pages/ReportsPage.tsx
//
// Страница отчётов и аналитики.
// Графики: посещения за период, доходы по месяцам.
// Отличается от дашборда: здесь выбор периода и детальные графики.

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { getVisitStats, getRevenueStats, getDashboardData } from "../lib/tauri";
import { useUIStore } from "../store/uiStore";
import type { VisitStats, RevenueStats, DashboardData } from "../types";

/** Вкладки отчётов */
const TABS = [
  { id: "visits", label: "Посещения" },
  { id: "revenue", label: "Доходы" },
  { id: "summary", label: "Сводка" },
] as const;

type ReportTab = (typeof TABS)[number]["id"];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("visits");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Отчёты</h1>

      {/* Вкладки */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        {activeTab === "visits" && <VisitsReport />}
        {activeTab === "revenue" && <RevenueReport />}
        {activeTab === "summary" && <SummaryReport />}
      </div>
    </div>
  );
}

// === Вкладка "Посещения" ===

function VisitsReport() {
  const addNotification = useUIStore((state) => state.addNotification);

  const [stats, setStats] = useState<readonly VisitStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Период: по умолчанию последние 30 дней
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getVisitStats(dateFrom, dateTo);
      setStats(data);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка загрузки";
      addNotification("error", message);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, addNotification]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Считаем статистику
  const totalVisits = stats.reduce((sum, s) => sum + s.count, 0);
  const avgPerDay = stats.length > 0 ? (totalVisits / stats.length).toFixed(1) : "0";
  const maxDay = stats.length > 0 ? Math.max(...stats.map((s) => s.count)) : 0;

  // Форматируем даты для графика (DD.MM вместо YYYY-MM-DD)
  const chartData = stats.map((s) => ({
    ...s,
    label: `${s.date.slice(8, 10)}.${s.date.slice(5, 7)}`,
  }));

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Фильтры по дате */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label htmlFor="visits-from" className="mb-1 block text-xs font-medium text-slate-600">С</label>
          <input
            id="visits-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label htmlFor="visits-to" className="mb-1 block text-xs font-medium text-slate-600">По</label>
          <input
            id="visits-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        {/* Быстрые кнопки */}
        <div className="flex gap-2 pt-5">
          <QuickPeriodButton label="7 дней" days={7} onSelect={setDateFrom} />
          <QuickPeriodButton label="30 дней" days={30} onSelect={setDateFrom} />
          <QuickPeriodButton label="90 дней" days={90} onSelect={setDateFrom} />
        </div>
      </div>

      {/* Карточки статистики */}
      <div className="flex gap-4">
        <MiniStat label="Всего посещений" value={String(totalVisits)} />
        <MiniStat label="Среднее в день" value={avgPerDay} />
        <MiniStat label="Максимум за день" value={String(maxDay)} />
      </div>

      {/* График */}
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">Нет данных за выбранный период</p>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval={Math.max(0, Math.floor(chartData.length / 15))}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                labelFormatter={(label) => `Дата: ${label}`}
                formatter={(value) => [`${value}`, "Посещений"]}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// === Вкладка "Доходы" ===

function RevenueReport() {
  const addNotification = useUIStore((state) => state.addNotification);

  const [stats, setStats] = useState<readonly RevenueStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getRevenueStats(12)
      .then(setStats)
      .catch((err) => {
        const message = typeof err === "string" ? err : "Ошибка загрузки";
        addNotification("error", message);
      })
      .finally(() => setIsLoading(false));
  }, [addNotification]);

  const totalRevenue = stats.reduce((sum, s) => sum + s.total, 0);
  const avgPerMonth = stats.length > 0 ? (totalRevenue / stats.length).toFixed(2) : "0.00";

  // Форматируем месяц для графика (MM.YYYY)
  const chartData = stats.map((s) => ({
    ...s,
    label: `${s.month.slice(5, 7)}.${s.month.slice(0, 4)}`,
  }));

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Карточки */}
      <div className="flex gap-4">
        <MiniStat label="Общий доход" value={`${totalRevenue.toFixed(2)} BYN`} />
        <MiniStat label="Среднее в месяц" value={`${avgPerMonth} BYN`} />
        <MiniStat label="Месяцев в отчёте" value={String(stats.length)} />
      </div>

      {/* График */}
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">Нет данных о доходах</p>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                labelFormatter={(label) => `Месяц: ${label}`}
                formatter={(value) => [`${Number(value).toFixed(2)} BYN`, "Доход"]}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ fill: "#16a34a", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// === Вкладка "Сводка" ===

function SummaryReport() {
  const addNotification = useUIStore((state) => state.addNotification);

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getDashboardData(30)
      .then(setData)
      .catch((err) => {
        const message = typeof err === "string" ? err : "Ошибка загрузки";
        addNotification("error", message);
      })
      .finally(() => setIsLoading(false));
  }, [addNotification]);

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>;
  }

  if (!data) {
    return <p className="py-8 text-center text-sm text-slate-400">Не удалось загрузить данные</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat label="Всего клиентов" value={String(data.total_clients)} />
        <MiniStat label="Активных абонементов" value={String(data.active_subscriptions)} />
        <MiniStat label="Посещений сегодня" value={String(data.visits_today)} />
        <MiniStat label="Доход за месяц" value={`${data.revenue_this_month.toFixed(2)} BYN`} />
      </div>

      {data.expiring_soon.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Истекающие абонементы ({data.expiring_soon.length})
          </h3>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {data.expiring_soon.map((item) => (
              <div key={`${item.client_id}-${item.end_date}`} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.client_name}</p>
                  <p className="text-xs text-slate-500">{item.subscription_type}</p>
                </div>
                <span className={`text-xs font-medium ${item.days_left <= 0 ? "text-red-600" : item.days_left <= 3 ? "text-red-500" : "text-amber-600"}`}>
                  {item.days_left <= 0 ? "ИСТЁК" : `${item.days_left} дн.`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// === Вспомогательные компоненты ===

function MiniStat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function QuickPeriodButton({
  label,
  days,
  onSelect,
}: {
  readonly label: string;
  readonly days: number;
  readonly onSelect: (date: string) => void;
}) {
  const handleClick = () => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    onSelect(d.toISOString().split("T")[0]);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
    >
      {label}
    </button>
  );
}