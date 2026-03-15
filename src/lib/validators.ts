// src/lib/validators.ts
//
// Zod 4 схемы валидации форм.
// Zod — библиотека валидации: описываем форму как схему,
// и она автоматически проверяет данные + генерирует сообщения об ошибках.
// Интегрируется с React Hook Form через @hookform/resolvers.
//
// Все сообщения об ошибках — на русском (администратор не знает английский).
// Zod 4 использует { error: "..." } вместо errorMap / invalid_type_error / required_error.

import { z } from "zod";

// ============================================================
// Авторизация
// ============================================================

/** Схема формы входа */
export const loginSchema = z.object({
  // trim() — убирает пробелы по краям перед проверкой
  // min(1) — не может быть пустым
  username: z
    .string()
    .trim()
    .min(1, "Введите логин"),
  password: z
    .string()
    .min(1, "Введите пароль"),
});

/** TypeScript тип, сгенерированный из схемы — используется в React Hook Form */
export type LoginFormData = z.infer<typeof loginSchema>;

/** Схема формы смены пароля */
export const changePasswordSchema = z
  .object({
    old_password: z
      .string()
      .min(1, "Введите текущий пароль"),
    new_password: z
      .string()
      .min(4, "Минимум 4 символа"),
    confirm_password: z
      .string()
      .min(1, "Подтвердите пароль"),
  })
  .refine(
    // refine — кастомная проверка: новый пароль должен совпадать с подтверждением
    (data) => data.new_password === data.confirm_password,
    {
      message: "Пароли не совпадают",
      path: ["confirm_password"], // ошибка будет привязана к полю confirm_password
    },
  );

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// ============================================================
// Клиенты
// ============================================================

/** Схема формы добавления/редактирования клиента */
export const clientSchema = z.object({
  last_name: z
    .string()
    .trim()
    .min(1, "Введите фамилию"),
  first_name: z
    .string()
    .trim()
    .min(1, "Введите имя"),
  middle_name: z
    .string()
    .trim()
    .optional(),
  phone: z
    .string()
    .trim()
    .optional(),
  birth_date: z
    .string()
    .optional(),
  trainer_id: z
    .number()
    .nullable()
    .optional(),
  medical_notes: z
    .string()
    .trim()
    .optional(),
  notes: z
    .string()
    .trim()
    .optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

// ============================================================
// Пользователи (создание тренера)
// ============================================================

/** Схема формы создания пользователя */
export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Введите логин")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Логин может содержать только латинские буквы, цифры и _",
    ),
  password: z
    .string()
    .min(4, "Минимум 4 символа"),
  full_name: z
    .string()
    .trim()
    .min(1, "Введите ФИО"),
  // Zod 4: enum с кастомным сообщением через { error: "..." }
  role: z.enum(["admin", "trainer"], { error: "Выберите роль" }),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

// ============================================================
// Типы абонементов
// ============================================================

/** Схема формы создания/редактирования типа абонемента */
export const subscriptionTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Введите название"),
  duration_days: z
    .number({ error: "Введите число" })
    .int("Должно быть целым числом")
    .positive("Должно быть больше 0")
    .nullable()
    .optional()
    .transform((val) => val ?? null),
  price: z
    .number({ error: "Введите сумму" })
    .positive("Цена должна быть больше 0"),
});

export type SubscriptionTypeFormValues = z.infer<typeof subscriptionTypeSchema>;

// ============================================================
// Оплаты
// ============================================================

/** Схема формы создания оплаты */
export const paymentSchema = z.object({
  client_id: z
    .number({ error: "Выберите клиента" })
    .positive("Выберите клиента"),
  subscription_id: z
    .number()
    .nullable()
    .optional()
    .transform((val) => val ?? null),
  amount: z
    .number({ error: "Введите сумму" })
    .positive("Сумма должна быть больше 0"),
  payment_date: z
    .string()
    .min(1, "Выберите дату"),
  description: z
    .string()
    .trim()
    .optional()
    .transform((val) => val || null),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

// ============================================================
// Абонементы
// ============================================================

/** Схема формы создания абонемента */
export const subscriptionSchema = z.object({
  client_id: z
    .number({ error: "Выберите клиента" })
    .positive("Выберите клиента"),
  type_id: z
    .number({ error: "Выберите тип абонемента" })
    .positive("Выберите тип абонемента"),
  start_date: z
    .string()
    .min(1, "Выберите дату начала"),
});

export type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;