// src/lib/tauri.ts
//
// Типизированная обёртка над Tauri invoke().

import { invoke } from "@tauri-apps/api/core";
import type {
  LoginRequest,
  LoginResponse,
  ChangePasswordRequest,
  CreateUserRequest,
  User,
  ClientFilters,
  ClientListResponse,
  Client,
  ClientFormData,
  ClientListItem,
  SubscriptionType,
  SubscriptionTypeFormData,
  Subscription,
  CreateSubscriptionRequest,
  Payment,
  PaymentFilters,
  CreatePaymentRequest,
  Visit,
  CreateVisitRequest,
  VisitStats,
  DashboardData,
  RevenueStats,
  ImportPreviewRow,
  ImportResult,
} from "../types";

// ============================================================
// Авторизация
// ============================================================

export async function login(request: LoginRequest): Promise<LoginResponse> {
  return invoke<LoginResponse>("login", { request });
}

export async function changePassword(request: ChangePasswordRequest): Promise<string> {
  return invoke<string>("change_password", { request });
}

export async function getUsers(): Promise<User[]> {
  return invoke<User[]>("get_users");
}

export async function createUser(request: CreateUserRequest): Promise<User> {
  return invoke<User>("create_user", { request });
}

export async function toggleUserActive(userId: number, currentUserId: number): Promise<string> {
  return invoke<string>("toggle_user_active", { userId, currentUserId });
}

export async function resetUserPassword(userId: number, newPassword: string): Promise<string> {
  return invoke<string>("reset_user_password", { userId, newPassword });
}

// ============================================================
// Клиенты
// ============================================================

export async function getClients(filters: ClientFilters): Promise<ClientListResponse> {
  return invoke<ClientListResponse>("get_clients", { filters });
}

export async function getClient(clientId: number): Promise<Client> {
  return invoke<Client>("get_client", { clientId });
}

export async function createClient(data: ClientFormData): Promise<Client> {
  return invoke<Client>("create_client", { data });
}

export async function updateClient(clientId: number, data: ClientFormData): Promise<Client> {
  return invoke<Client>("update_client", { clientId, data });
}

export async function toggleClientActive(clientId: number): Promise<string> {
  return invoke<string>("toggle_client_active", { clientId });
}

export async function searchClientsQuick(query: string): Promise<ClientListItem[]> {
  return invoke<ClientListItem[]>("search_clients_quick", { query });
}

export async function getTrainers(): Promise<User[]> {
  return invoke<User[]>("get_trainers");
}

// ============================================================
// Типы абонементов
// ============================================================

/** Получить типы абонементов (includeInactive = true → все, false → только активные) */
export async function getSubscriptionTypes(includeInactive?: boolean): Promise<SubscriptionType[]> {
  return invoke<SubscriptionType[]>("get_subscription_types", { includeInactive });
}

/** Создать тип абонемента */
export async function createSubscriptionType(data: SubscriptionTypeFormData): Promise<SubscriptionType> {
  return invoke<SubscriptionType>("create_subscription_type", { data });
}

/** Обновить тип абонемента */
export async function updateSubscriptionType(typeId: number, data: SubscriptionTypeFormData): Promise<string> {
  return invoke<string>("update_subscription_type", { typeId, data });
}

/** Включить/выключить тип абонемента */
export async function toggleSubscriptionTypeActive(typeId: number): Promise<string> {
  return invoke<string>("toggle_subscription_type_active", { typeId });
}

// ============================================================
// Абонементы клиентов
// ============================================================

/** Получить абонементы клиента */
export async function getClientSubscriptions(clientId: number): Promise<Subscription[]> {
  return invoke<Subscription[]>("get_client_subscriptions", { clientId });
}

/** Создать абонемент клиенту */
export async function createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
  return invoke<Subscription>("create_subscription", { request });
}

/** Обновить статусы истёкших абонементов */
export async function updateExpiredSubscriptions(): Promise<number> {
  return invoke<number>("update_expired_subscriptions");
}

// ============================================================
// Оплаты
// ============================================================

/** Получить оплаты клиента */
export async function getClientPayments(clientId: number): Promise<Payment[]> {
  return invoke<Payment[]>("get_client_payments", { clientId });
}

/** Получить все оплаты с фильтрами */
export async function getPayments(filters: PaymentFilters): Promise<Payment[]> {
  return invoke<Payment[]>("get_payments", { filters });
}

/** Создать оплату */
export async function createPayment(request: CreatePaymentRequest, receivedBy: number): Promise<Payment> {
  return invoke<Payment>("create_payment", { request, receivedBy });
}

/** Получить итоговую сумму оплат за период */
export async function getPaymentsTotal(dateFrom?: string | null, dateTo?: string | null): Promise<number> {
  return invoke<number>("get_payments_total", { dateFrom, dateTo });
}

// ============================================================
// Посещения
// ============================================================

/** Отметить посещение клиента */
export async function createVisit(request: CreateVisitRequest, registeredBy: number): Promise<Visit> {
  return invoke<Visit>("create_visit", { request, registeredBy });
}

/** Получить посещения за сегодня */
export async function getTodayVisits(): Promise<Visit[]> {
  return invoke<Visit[]>("get_today_visits");
}

/** Получить посещения клиента */
export async function getClientVisits(clientId: number, limit?: number): Promise<Visit[]> {
  return invoke<Visit[]>("get_client_visits", { clientId, limit });
}

/** Отметить уход клиента */
export async function checkoutVisit(visitId: number): Promise<string> {
  return invoke<string>("checkout_visit", { visitId });
}

/** Статистика посещений за период */
export async function getVisitStats(dateFrom: string, dateTo: string): Promise<VisitStats[]> {
  return invoke<VisitStats[]>("get_visit_stats", { dateFrom, dateTo });
}

// ============================================================
// Дашборд и отчёты
// ============================================================

/** Получить данные для дашборда */
export async function getDashboardData(notificationDays?: number): Promise<DashboardData> {
  return invoke<DashboardData>("get_dashboard_data", { notificationDays });
}

/** Получить статистику доходов по месяцам */
export async function getRevenueStats(monthsBack?: number): Promise<RevenueStats[]> {
  return invoke<RevenueStats[]>("get_revenue_stats", { monthsBack });
}

// ============================================================
// Импорт из Excel
// ============================================================

/** Маппинг столбцов Excel → поля клиента */
export interface ColumnMapping {
  readonly fio_column: number | null;
  readonly last_name_column: number | null;
  readonly first_name_column: number | null;
  readonly middle_name_column: number | null;
  readonly phone_column: number | null;
  readonly birth_date_column: number | null;
  readonly start_row: number | null;
}

/** Получить названия столбцов из Excel-файла */
export async function getExcelColumns(filePath: string): Promise<string[]> {
  return invoke<string[]>("get_excel_columns", { filePath });
}

/** Предпросмотр импорта — прочитать файл и показать что будет импортировано */
export async function previewImport(filePath: string, columnMapping: ColumnMapping): Promise<ImportPreviewRow[]> {
  return invoke<ImportPreviewRow[]>("preview_import", { filePath, columnMapping });
}

/** Выполнить импорт подтверждённых строк */
export async function executeImport(rows: ImportPreviewRow[]): Promise<ImportResult> {
  return invoke<ImportResult>("execute_import", { rows });
}

// ============================================================
// Экспорт в Excel
// ============================================================

/** Экспорт клиентов в Excel */
export async function exportClients(outputPath: string, includeInactive?: boolean): Promise<string> {
  return invoke<string>("export_clients", { outputPath, includeInactive });
}

/** Экспорт оплат в Excel */
export async function exportPayments(outputPath: string, dateFrom?: string | null, dateTo?: string | null): Promise<string> {
  return invoke<string>("export_payments", { outputPath, dateFrom, dateTo });
}

// ============================================================
// Бэкап и восстановление
// ============================================================

/** Информация о БД */
export interface DbInfo {
  readonly path: string;
  readonly size_display: string;
}

/** Получить информацию о базе данных */
export async function getDbInfo(): Promise<DbInfo> {
  return invoke<DbInfo>("get_db_info");
}

/** Создать бэкап в указанную папку */
export async function createBackup(outputDir: string): Promise<string> {
  return invoke<string>("create_backup", { outputDir });
}

/** Восстановить БД из бэкапа */
export async function restoreBackup(backupPath: string): Promise<string> {
  return invoke<string>("restore_backup", { backupPath });
}

// ============================================================
// Настройки и логотип
// ============================================================

/** Загрузить логотип */
export async function uploadLogo(sourcePath: string): Promise<string> {
  return invoke<string>("upload_logo", { sourcePath });
}

/** Получить путь к логотипу */
export async function getLogoPath(): Promise<string | null> {
  return invoke<string | null>("get_logo_path");
}

/** Получить логотип как base64 data URI */
export async function getLogoBase64(): Promise<string | null> {
  return invoke<string | null>("get_logo_base64");
}
/** Получить значение настройки */
export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_setting", { key });
}

/** Установить значение настройки */
export async function setSetting(key: string, value: string): Promise<string> {
  return invoke<string>("set_setting", { key, value });
}

/** Загрузить фото клиента */
export async function uploadClientPhoto(clientId: number, sourcePath: string): Promise<string> {
  return invoke<string>("upload_client_photo", { clientId, sourcePath });
}

/** Получить фото клиента как base64 */
export async function getClientPhotoBase64(clientId: number): Promise<string | null> {
  return invoke<string | null>("get_client_photo_base64", { clientId });
}

/** Сгенерировать мастер-ключ восстановления */
export async function generateRecoveryKey(): Promise<string | null> {
  return invoke<string | null>("generate_recovery_key");
}

/** Сбросить пароль по мастер-ключу */
export async function recoverAdminPassword(recoveryKey: string, newPassword: string): Promise<string> {
  return invoke<string>("recover_admin_password", { recoveryKey, newPassword });
}

// ============================================================
// Тренировки
// ============================================================

export interface Exercise {
  readonly id: number;
  readonly name: string;
  readonly muscle_group: string | null;
  readonly is_active: boolean;
}

export interface WorkoutTemplate {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly trainer_name: string | null;
  readonly exercises: readonly TemplateExercise[];
}

export interface TemplateExercise {
  readonly id: number;
  readonly exercise_id: number;
  readonly exercise_name: string;
  readonly muscle_group: string | null;
  readonly order_index: number;
  readonly default_sets: number;
  readonly default_reps: number;
  readonly notes: string | null;
}

export interface Workout {
  readonly id: number;
  readonly client_id: number;
  readonly client_name: string;
  readonly trainer_name: string | null;
  readonly template_name: string | null;
  readonly workout_date: string;
  readonly notes: string | null;
  readonly exercises: readonly WorkoutExercise[];
}

export interface WorkoutExercise {
  readonly id: number;
  readonly exercise_id: number;
  readonly exercise_name: string;
  readonly muscle_group: string | null;
  readonly order_index: number;
  readonly sets_data: string;
  readonly notes: string | null;
}

export interface SetData {
  readonly weight: number;
  readonly reps: number;
}

export interface CreateWorkoutExercise {
  readonly exercise_id: number;
  readonly order_index: number;
  readonly sets_data: string;
  readonly notes: string | null;
}

export interface CreateWorkoutRequest {
  readonly client_id: number;
  readonly trainer_id: number | null;
  readonly template_id: number | null;
  readonly workout_date: string;
  readonly notes: string | null;
  readonly exercises: readonly CreateWorkoutExercise[];
}

export async function getExercises(includeInactive?: boolean): Promise<Exercise[]> {
  return invoke<Exercise[]>("get_exercises", { includeInactive });
}

export async function createExercise(name: string, muscleGroup?: string | null): Promise<Exercise> {
  return invoke<Exercise>("create_exercise", { name, muscleGroup });
}

export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  return invoke<WorkoutTemplate[]>("get_workout_templates");
}

export async function createWorkoutTemplate(
  name: string,
  description: string | null,
  trainerId: number | null,
  exercises: readonly CreateWorkoutExercise[],
): Promise<string> {
  return invoke<string>("create_workout_template", { name, description, trainerId, exercises: [...exercises] });
}

export async function getClientWorkouts(clientId: number, limit?: number): Promise<Workout[]> {
  return invoke<Workout[]>("get_client_workouts", { clientId, limit });
}

export async function createWorkout(request: CreateWorkoutRequest): Promise<string> {
  return invoke<string>("create_workout", { request: { ...request, exercises: [...request.exercises] } });
}