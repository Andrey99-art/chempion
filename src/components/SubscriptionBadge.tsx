// src/components/SubscriptionBadge.tsx
//
// Цветной бейдж для отображения статуса абонемента в таблицах и карточках.
// Зелёный = активен, красный = истёк, синий = заморожен, серый = нет абонемента.
// Также показывает количество оставшихся дней (если абонемент активен).

import { formatSubscriptionStatus, daysUntil } from "../lib/formatters";

interface SubscriptionBadgeProps {
  /** Статус абонемента: "active", "expired", "frozen" или null */
  readonly status: string | null;
  /** Дата окончания абонемента (ISO 8601) — для расчёта оставшихся дней */
  readonly endDate?: string | null;
}

export default function SubscriptionBadge({ status, endDate }: SubscriptionBadgeProps) {
  // Считаем дни до окончания (если есть дата)
  const daysLeft = endDate ? daysUntil(endDate) : null;

  // Определяем цвет бейджа в зависимости от статуса и оставшихся дней
  const badgeConfig = getBadgeConfig(status, daysLeft);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeConfig.classes}`}
    >
      {/* Цветная точка-индикатор */}
      <span className={`h-1.5 w-1.5 rounded-full ${badgeConfig.dotClass}`} />
      {/* Текст статуса */}
      {badgeConfig.label}
    </span>
  );
}

/** Конфигурация внешнего вида бейджа */
interface BadgeConfig {
  readonly classes: string;    // CSS-классы фона и текста
  readonly dotClass: string;   // CSS-класс цветной точки
  readonly label: string;      // Текст на русском
}

/** Определяет цвет и текст бейджа по статусу и оставшимся дням */
function getBadgeConfig(status: string | null, daysLeft: number | null): BadgeConfig {
  // Нет абонемента — серый бейдж
  if (!status) {
    return {
      classes: "bg-slate-100 text-slate-600",
      dotClass: "bg-slate-400",
      label: "Нет абонемента",
    };
  }

  // Заморожен — синий
  if (status === "frozen") {
    return {
      classes: "bg-blue-50 text-blue-700",
      dotClass: "bg-blue-500",
      label: "Заморожен",
    };
  }

  // Истёк — красный
  if (status === "expired") {
    return {
      classes: "bg-red-50 text-red-700",
      dotClass: "bg-red-500",
      label: "Истёк",
    };
  }

  // Активен — цвет зависит от оставшихся дней
  if (status === "active" && daysLeft !== null) {
    // Истёк (дни ≤ 0) — красный с текстом "ИСТЁК"
    if (daysLeft <= 0) {
      return {
        classes: "bg-red-50 text-red-700",
        dotClass: "bg-red-500",
        label: "ИСТЁК",
      };
    }
    // 1-3 дня — красный с предупреждением
    if (daysLeft <= 3) {
      return {
        classes: "bg-red-50 text-red-700",
        dotClass: "bg-red-500",
        label: `${daysLeft} дн.`,
      };
    }
    // 4-7 дней — оранжевый
    if (daysLeft <= 7) {
      return {
        classes: "bg-amber-50 text-amber-700",
        dotClass: "bg-amber-500",
        label: `${daysLeft} дн.`,
      };
    }
    // Больше 7 дней — зелёный
    return {
      classes: "bg-green-50 text-green-700",
      dotClass: "bg-green-500",
      label: formatSubscriptionStatus(status),
    };
  }

  // Активен без даты — просто зелёный
  return {
    classes: "bg-green-50 text-green-700",
    dotClass: "bg-green-500",
    label: formatSubscriptionStatus(status),
  };
}