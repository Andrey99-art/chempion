// src/components/NotificationToast.tsx
//
// Всплывающие уведомления (toast) в правом верхнем углу.
// Появляются при действиях: "Клиент добавлен", "Ошибка", и т.д.
// Автоматически исчезают через 4 секунды (настроено в uiStore).

import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useUIStore } from "../store/uiStore";

/** Конфигурация иконки и цвета по типу уведомления */
const TOAST_CONFIG = {
  success: {
    icon: CheckCircle,
    bg: "bg-green-50 border-green-200",
    iconColor: "text-green-500",
    textColor: "text-green-800",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-red-50 border-red-200",
    iconColor: "text-red-500",
    textColor: "text-red-800",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 border-amber-200",
    iconColor: "text-amber-500",
    textColor: "text-amber-800",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-500",
    textColor: "text-blue-800",
  },
} as const;

export default function NotificationToast() {
  const { notifications, removeNotification } = useUIStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed right-4 top-16 z-50 flex flex-col gap-2">
      {notifications.map((notification) => {
        const config = TOAST_CONFIG[notification.type];
        const Icon = config.icon;

        return (
          <div
            key={notification.id}
            className={`flex w-80 items-start gap-3 rounded-lg border p-3 shadow-lg ${config.bg}`}
          >
            <Icon className={`h-5 w-5 shrink-0 ${config.iconColor}`} />
            <p className={`flex-1 text-sm ${config.textColor}`}>
              {notification.message}
            </p>
            <button
              type="button"
              onClick={() => removeNotification(notification.id)}
              className="shrink-0 rounded p-0.5 text-slate-400 transition hover:text-slate-600"
              aria-label="Закрыть уведомление"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}