// src/lib/formatters.ts
//
// Функции форматирования для отображения в UI.
// Все даты из БД приходят в формате ISO 8601 (2025-03-15T14:30:00).
// Здесь мы преобразуем их в человекочитаемый русский формат.

import { format, parseISO, differenceInDays, isValid } from "date-fns";
import { ru } from "date-fns/locale";

/**
 * Форматирует дату ISO 8601 → "15 марта 2025"
 * Используется в карточке клиента, истории оплат.
 */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";

  const parsed = parseISO(isoDate);
  if (!isValid(parsed)) return "—";

  return format(parsed, "d MMMM yyyy", { locale: ru });
}

/**
 * Форматирует дату ISO 8601 → "15.03.2025"
 * Короткий формат — для таблиц где мало места.
 */
export function formatDateShort(isoDate: string | null): string {
  if (!isoDate) return "—";

  const parsed = parseISO(isoDate);
  if (!isValid(parsed)) return "—";

  return format(parsed, "dd.MM.yyyy");
}

/**
 * Форматирует дату и время ISO 8601 → "15.03.2025 14:30"
 * Используется в истории действий, логах.
 */
export function formatDateTime(isoDate: string | null): string {
  if (!isoDate) return "—";

  const parsed = parseISO(isoDate);
  if (!isValid(parsed)) return "—";

  return format(parsed, "dd.MM.yyyy HH:mm");
}

/**
 * Считает количество дней от сегодня до указанной даты.
 * Положительное число = дата в будущем (дней осталось).
 * Отрицательное = дата в прошлом (дней просрочено).
 * Используется для уведомлений об истечении абонемента.
 */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;

  const parsed = parseISO(isoDate);
  if (!isValid(parsed)) return null;

  return differenceInDays(parsed, new Date());
}

/**
 * Форматирует сумму в BYN → "50.00 BYN"
 * toFixed(2) — всегда два знака после запятой.
 */
export function formatMoney(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

/**
 * Форматирует телефон для отображения.
 * "+375291234567" → "+375 (29) 123-45-67"
 * Если формат не распознан — возвращает как есть.
 */
export function formatPhone(phone: string | null): string {
  if (!phone) return "—";

  // Убираем всё кроме цифр и "+"
  const cleaned = phone.replace(/[^\d+]/g, "");

  // Белорусский формат: +375XXYYYYYYY (13 символов)
  if (cleaned.startsWith("+375") && cleaned.length === 13) {
    const code = cleaned.slice(4, 6);    // оператор (29, 33, 44...)
    const part1 = cleaned.slice(6, 9);   // первые 3 цифры
    const part2 = cleaned.slice(9, 11);  // следующие 2
    const part3 = cleaned.slice(11, 13); // последние 2
    return `+375 (${code}) ${part1}-${part2}-${part3}`;
  }

  // Белорусский формат без "+": 80XXYYYYYYY (11 символов)
  if (cleaned.startsWith("80") && cleaned.length === 11) {
    const code = cleaned.slice(2, 4);
    const part1 = cleaned.slice(4, 7);
    const part2 = cleaned.slice(7, 9);
    const part3 = cleaned.slice(9, 11);
    return `8 (0${code}) ${part1}-${part2}-${part3}`;
  }

  // Неизвестный формат — возвращаем как есть
  return phone;
}

/**
 * Формирует полное ФИО из частей.
 * Отчество опционально — если null, не добавляется.
 */
export function formatFullName(
  lastName: string,
  firstName: string,
  middleName: string | null,
): string {
  const parts = [lastName, firstName];
  if (middleName) {
    parts.push(middleName);
  }
  return parts.join(" ");
}

/**
 * Возвращает текст статуса абонемента на русском.
 */
export function formatSubscriptionStatus(status: string | null): string {
  switch (status) {
    case "active":
      return "Активен";
    case "expired":
      return "Истёк";
    case "frozen":
      return "Заморожен";
    default:
      return "Нет абонемента";
  }
}