// src/store/uiStore.ts
//
// Zustand store для общего UI-состояния.
// Управляет: уведомлениями (toast-сообщения), состоянием сайдбара,
// модальными окнами и темой оформления.
// Используется глобально во всём приложении.

import { create } from "zustand";

/** Типы уведомлений — влияют на цвет и иконку */
type NotificationType = "success" | "error" | "warning" | "info";

/** Одно уведомление (toast-сообщение) */
interface Notification {
  readonly id: string;                   // уникальный id для удаления
  readonly type: NotificationType;       // тип: успех, ошибка, предупреждение, инфо
  readonly message: string;              // текст сообщения
}

/** Структура store UI */
interface UIState {
  // --- Данные ---
  notifications: readonly Notification[];  // список активных уведомлений
  isSidebarCollapsed: boolean;             // свёрнут ли сайдбар
  theme: "light" | "dark";                 // текущая тема

  // --- Методы уведомлений ---
  /** Показать уведомление (автоматически исчезает через 4 секунды) */
  addNotification: (type: NotificationType, message: string) => void;
  /** Убрать уведомление вручную (по клику на крестик) */
  removeNotification: (id: string) => void;

  // --- Методы сайдбара ---
  /** Переключить состояние сайдбара (свернуть/развернуть) */
  toggleSidebar: () => void;

  // --- Методы темы ---
  /** Установить тему */
  setTheme: (theme: "light" | "dark") => void;
}

/** Генерация простого уникального id для уведомлений */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useUIStore = create<UIState>((set) => ({
  // --- Начальное состояние ---
  notifications: [],
  isSidebarCollapsed: false,
  theme: "light",

  // --- Показать уведомление ---
  addNotification: (type: NotificationType, message: string) => {
    const id = generateId();

    // Добавляем уведомление в начало списка
    set((state) => ({
      notifications: [{ id, type, message }, ...state.notifications],
    }));

    // Автоматически убираем через 4 секунды
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 4000);
  },

  // --- Убрать уведомление вручную ---
  removeNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  // --- Переключить сайдбар ---
  toggleSidebar: () => {
    set((state) => ({
      isSidebarCollapsed: !state.isSidebarCollapsed,
    }));
  },

  // --- Установить тему ---
  setTheme: (theme: "light" | "dark") => {
    set({ theme });
    // Применяем класс dark к <html> — Tailwind использует его для тёмной темы
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  },
}));