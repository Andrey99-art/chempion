// src/components/Layout.tsx
//
// Главный layout приложения: сайдбар слева, header сверху, контент справа.
// Сайдбар содержит навигацию по разделам (иконки + текст).
// Header показывает имя пользователя и кнопку выхода.
// Сайдбар сворачивается (только иконки) для экономии места.
// Тренер видит ограниченное меню (без настроек, бэкапа, импорта).

import { type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  BarChart3,
  Settings,
  FileDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Dumbbell,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { useEffect, useState } from "react";
import { getLogoBase64 } from "../lib/tauri";
import { getLogoBase64 } from "../lib/tauri";

/** Один пункт навигации */
interface NavItem {
  readonly id: string;           // уникальный ключ (используется как route)
  readonly label: string;        // текст на русском
  readonly icon: ReactNode;      // иконка Lucide
  readonly adminOnly: boolean;   // доступно только администратору?
}

/** Все пункты навигации */
const NAV_ITEMS: readonly NavItem[] = [
  { id: "dashboard",  label: "Главная",      icon: <LayoutDashboard className="h-5 w-5" />, adminOnly: false },
  { id: "clients",    label: "Клиенты",      icon: <Users className="h-5 w-5" />,           adminOnly: false },
  { id: "visits",     label: "Посещения",    icon: <CalendarCheck className="h-5 w-5" />,   adminOnly: false },
  { id: "payments",   label: "Оплаты",       icon: <CreditCard className="h-5 w-5" />,      adminOnly: true },
  { id: "reports",    label: "Отчёты",       icon: <BarChart3 className="h-5 w-5" />,       adminOnly: true },
  { id: "import",     label: "Импорт",       icon: <FileDown className="h-5 w-5" />,        adminOnly: true },
  { id: "settings",   label: "Настройки",    icon: <Settings className="h-5 w-5" />,        adminOnly: true },
];

/** Пропсы компонента Layout */
interface LayoutProps {
  readonly currentPage: string;                     // текущая активная страница
  readonly onNavigate: (page: string) => void;      // обработчик навигации
  readonly children: ReactNode;                      // содержимое страницы
}

/** Логотип зала — загружается из файла или показывает заглушку */
function LogoImage() {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    getLogoBase64().then((data) => {
      if (data) setLogoSrc(data);
    }).catch(() => {});
  }, []);

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt="Логотип"
        className="h-9 w-9 shrink-0 rounded-lg object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
      <Dumbbell className="h-5 w-5" />
    </div>
  );
}
export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const { isSidebarCollapsed, toggleSidebar } = useUIStore();

  // Фильтруем пункты меню по роли пользователя
  const isAdmin = user?.role === "admin";
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  return (
    <div className="flex h-screen bg-slate-100">
      {/* === Сайдбар === */}
      <aside
        className={`flex flex-col border-r border-slate-200 bg-slate-900 text-white transition-all duration-300 ${
          isSidebarCollapsed ? "w-16" : "w-60"
        }`}
      >
        {/* --- Логотип и название --- */}
        <div className="flex h-14 items-center gap-3 border-b border-slate-700 px-3">
          <LogoImage />
          {!isSidebarCollapsed && (
            <span className="text-lg font-bold tracking-tight">Чемпион</span>
          )}
        </div>

        {/* --- Навигация --- */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {visibleItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {/* Иконка — всегда видна */}
                <span className="shrink-0">{item.icon}</span>
                {/* Текст — скрывается при сворачивании */}
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* --- Кнопка сворачивания сайдбара --- */}
        <div className="border-t border-slate-700 p-2">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title={isSidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            <span className="shrink-0">
              {isSidebarCollapsed
                ? <PanelLeftOpen className="h-5 w-5" />
                : <PanelLeftClose className="h-5 w-5" />
              }
            </span>
            {!isSidebarCollapsed && <span>Свернуть</span>}
          </button>
        </div>
      </aside>

      {/* === Основная часть (header + контент) === */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* --- Header --- */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          {/* Левая часть — название текущей страницы */}
          <h2 className="text-lg font-semibold text-slate-800">
            {visibleItems.find((item) => item.id === currentPage)?.label ?? ""}
          </h2>

          {/* Правая часть — пользователь + выход */}
          <div className="flex items-center gap-4">
            {/* Имя и роль пользователя */}
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">
                {user?.full_name ?? ""}
              </p>
              <p className="text-xs text-slate-400">
                {isAdmin ? "Администратор" : "Тренер"}
              </p>
            </div>

            {/* Кнопка выхода */}
            <button
              type="button"
              onClick={logout}
              title="Выйти"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-red-500"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* --- Область контента --- */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}