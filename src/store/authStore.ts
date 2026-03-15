// src/store/authStore.ts
//
// Zustand store для управления авторизацией.
// Zustand — лёгкий стейт-менеджер: создаём store с данными и методами,
// используем в компонентах через хук useAuthStore().
//
// Хранит: текущий пользователь, статус загрузки, ошибка.
// Методы: логин, выход, смена пароля.

import { create } from "zustand";
import type { User } from "../types";
import { login as apiLogin, changePassword as apiChangePassword } from "../lib/tauri";

/** Структура store авторизации */
interface AuthState {
  // --- Данные ---
  user: User | null;              // текущий пользователь (null = не залогинен)
  isLoading: boolean;             // идёт ли запрос (логин, смена пароля)
  error: string | null;           // текст ошибки (null = нет ошибки)

  // --- Методы ---
  /** Вход в систему */
  performLogin: (username: string, password: string) => Promise<boolean>;
  /** Выход из системы */
  logout: () => void;
  /** Смена пароля */
  performChangePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  /** Очистить ошибку (например, при повторном вводе) */
  clearError: () => void;
}

/**
 * create() — создаёт Zustand store.
 * set — функция для обновления состояния.
 * get — функция для чтения текущего состояния.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  // --- Начальное состояние ---
  user: null,
  isLoading: false,
  error: null,

  // --- Вход в систему ---
  performLogin: async (username: string, password: string): Promise<boolean> => {
    // Сбрасываем ошибку и включаем индикатор загрузки
    set({ isLoading: true, error: null });

    try {
      // Вызываем Rust-команду login через IPC
      const response = await apiLogin({ username, password });

      // Сохраняем пользователя в store
      set({
        user: response.user,
        isLoading: false,
        error: null,
      });

      return true; // успешный вход
    } catch (err) {
      // err — строка с ошибкой от Rust (например, "Неверный логин или пароль")
      const message = typeof err === "string" ? err : "Ошибка входа";
      set({ isLoading: false, error: message });
      return false; // неудачный вход
    }
  },

  // --- Выход из системы ---
  logout: () => {
    // Просто очищаем данные пользователя — возвращаемся на экран входа
    set({ user: null, error: null });
  },

  // --- Смена пароля ---
  performChangePassword: async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const { user } = get(); // получаем текущего пользователя из store
    if (!user) return false;

    set({ isLoading: true, error: null });

    try {
      await apiChangePassword({
        user_id: user.id,
        old_password: oldPassword,
        new_password: newPassword,
      });

      // После успешной смены пароля — снимаем флаг force_password_change
      set({
        user: { ...user, force_password_change: false },
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка смены пароля";
      set({ isLoading: false, error: message });
      return false;
    }
  },

  // --- Очистить ошибку ---
  clearError: () => {
    set({ error: null });
  },
}));