// src/types/index.ts
//
// Все TypeScript типы приложения.
// Должны точно соответствовать Rust-структурам из models/mod.rs.
// Rust Option<T> → TypeScript T | null
// Rust String → TypeScript string
// Rust i64 → TypeScript number
// Rust f64 → TypeScript number
// Rust bool → TypeScript boolean

// ============================================================
// Пользователи (администратор, тренеры)
// ============================================================

/** Пользователь приложения (без пароля — он никогда не приходит с бэкенда) */
export interface User {
  readonly id: number;
  readonly username: string;
  readonly full_name: string;
  readonly role: "admin" | "trainer";
  readonly is_active: boolean;
  readonly force_password_change: boolean;
  readonly created_at: string;
}

/** Данные для входа в систему */
export interface LoginRequest {
  readonly username: string;
  readonly password: string;
}

/** Ответ после успешного входа */
export interface LoginResponse {
  readonly user: User;
  readonly message: string;
}

/** Данные для смены пароля */
export interface ChangePasswordRequest {
  readonly user_id: number;
  readonly old_password: string;
  readonly new_password: string;
}

/** Данные для создания нового пользователя */
export interface CreateUserRequest {
  readonly username: string;
  readonly password: string;
  readonly full_name: string;
  readonly role: "admin" | "trainer";
}

// ============================================================
// Клиенты зала
// ============================================================

/** Полная информация о клиенте */
export interface Client {
  readonly id: number;
  readonly last_name: string;
  readonly first_name: string;
  readonly middle_name: string | null;
  readonly phone: string | null;
  readonly birth_date: string | null;
  readonly photo_path: string | null;
  readonly trainer_id: number | null;
  readonly trainer_name: string | null;
  readonly medical_notes: string | null;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Данные формы добавления/редактирования клиента */
export interface ClientFormData {
  readonly last_name: string;
  readonly first_name: string;
  readonly middle_name: string | null;
  readonly phone: string | null;
  readonly birth_date: string | null;
  readonly trainer_id: number | null;
  readonly medical_notes: string | null;
  readonly notes: string | null;
}

/** Фильтры для списка клиентов */
export interface ClientFilters {
  readonly search: string | null;
  readonly trainer_id: number | null;
  readonly subscription_status: string | null;
  readonly is_active: boolean | null;
  readonly page: number | null;
  readonly per_page: number | null;
}

/** Ответ со списком клиентов (с пагинацией) */
export interface ClientListResponse {
  readonly clients: readonly ClientListItem[];
  readonly total: number;
  readonly page: number;
  readonly per_page: number;
}

/** Краткая информация о клиенте — для таблицы */
export interface ClientListItem {
  readonly id: number;
  readonly last_name: string;
  readonly first_name: string;
  readonly middle_name: string | null;
  readonly phone: string | null;
  readonly trainer_name: string | null;
  readonly subscription_status: string | null;
  readonly subscription_end_date: string | null;
  readonly last_visit_date: string | null;
  readonly is_active: boolean;
}

// ============================================================
// Типы абонементов
// ============================================================

/** Тип абонемента (Месяц, Квартал, Разовое и т.д.) */
export interface SubscriptionType {
  readonly id: number;
  readonly name: string;
  readonly duration_days: number | null;
  readonly price: number;
  readonly is_active: boolean;
}

/** Данные формы создания/редактирования типа абонемента */
export interface SubscriptionTypeFormData {
  readonly name: string;
  readonly duration_days: number | null;
  readonly price: number;
}

// ============================================================
// Абонементы клиентов
// ============================================================

/** Абонемент клиента */
export interface Subscription {
  readonly id: number;
  readonly client_id: number;
  readonly type_id: number;
  readonly type_name: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly status: "active" | "expired" | "frozen";
  readonly created_at: string;
}

/** Данные для создания абонемента */
export interface CreateSubscriptionRequest {
  readonly client_id: number;
  readonly type_id: number;
  readonly start_date: string;
}

// ============================================================
// Оплаты
// ============================================================

/** Запись об оплате */
export interface Payment {
  readonly id: number;
  readonly client_id: number;
  readonly client_name: string;
  readonly subscription_id: number | null;
  readonly amount: number;
  readonly payment_date: string;
  readonly description: string | null;
  readonly received_by: number | null;
  readonly received_by_name: string | null;
  readonly created_at: string;
}

/** Данные для создания оплаты */
export interface CreatePaymentRequest {
  readonly client_id: number;
  readonly subscription_id: number | null;
  readonly amount: number;
  readonly payment_date: string;
  readonly description: string | null;
}

/** Фильтры для списка оплат */
export interface PaymentFilters {
  readonly date_from: string | null;
  readonly date_to: string | null;
  readonly client_id: number | null;
  readonly page: number | null;
  readonly per_page: number | null;
}

// ============================================================
// Посещения
// ============================================================

/** Запись о посещении */
export interface Visit {
  readonly id: number;
  readonly client_id: number;
  readonly client_name: string;
  readonly visit_date: string;
  readonly check_in_time: string;
  readonly check_out_time: string | null;
  readonly registered_by_name: string | null;
}

/** Данные для регистрации посещения */
export interface CreateVisitRequest {
  readonly client_id: number;
}

// ============================================================
// Дашборд и статистика
// ============================================================

/** Данные для главного экрана */
export interface DashboardData {
  readonly total_clients: number;
  readonly active_subscriptions: number;
  readonly visits_today: number;
  readonly revenue_this_month: number;
  readonly expiring_soon: readonly ExpiringSubscription[];
}

/** Клиент с истекающим абонементом */
export interface ExpiringSubscription {
  readonly client_id: number;
  readonly client_name: string;
  readonly subscription_type: string;
  readonly end_date: string;
  readonly days_left: number;
}

/** Статистика посещений за день (для графиков) */
export interface VisitStats {
  readonly date: string;
  readonly count: number;
}

/** Статистика доходов за месяц (для графиков) */
export interface RevenueStats {
  readonly month: string;
  readonly total: number;
}

// ============================================================
// Настройки
// ============================================================

/** Одна настройка (ключ-значение) */
export interface Setting {
  readonly key: string;
  readonly value: string | null;
}

// ============================================================
// Импорт из Excel
// ============================================================

/** Строка из Excel для предпросмотра перед импортом */
export interface ImportPreviewRow {
  readonly row_number: number;
  readonly last_name: string;
  readonly first_name: string;
  readonly middle_name: string | null;
  readonly phone: string | null;
  readonly birth_date: string | null;
  readonly is_valid: boolean;
  readonly errors: readonly string[];
}

/** Результат импорта */
export interface ImportResult {
  readonly imported: number;
  readonly skipped: number;
  readonly errors: readonly string[];
}