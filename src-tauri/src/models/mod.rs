// src-tauri/src/models/mod.rs
//
// Все структуры данных приложения.
// Serialize — преобразование структуры в JSON (Rust → фронтенд).
// Deserialize — преобразование JSON в структуру (фронтенд → Rust).
// Clone — возможность копировать структуру.
// Debug — вывод структуры в отладочную консоль.

use serde::{Deserialize, Serialize};

// ============================================================
// Пользователи (администратор, тренеры)
// ============================================================

/// Пользователь приложения — для отправки на фронтенд.
/// Пароль НЕ включён — никогда не отправляем хэш клиенту.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub full_name: String,
    pub role: String,                    // "admin" или "trainer"
    pub is_active: bool,
    pub force_password_change: bool,     // нужно ли сменить пароль при входе
    pub created_at: String,
}

/// Данные для входа в систему (приходят с фронтенда)
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Ответ после успешного входа
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub user: User,
    pub message: String,
}

/// Данные для смены пароля
#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub user_id: i64,
    pub old_password: String,
    pub new_password: String,
}

/// Данные для создания нового пользователя (тренера)
#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub full_name: String,
    pub role: String,
}

// ============================================================
// Клиенты зала
// ============================================================

/// Клиент — полная информация для отправки на фронтенд
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Client {
    pub id: i64,
    pub last_name: String,
    pub first_name: String,
    pub middle_name: Option<String>,     // Option — поле может быть пустым (NULL в БД)
    pub phone: Option<String>,
    pub birth_date: Option<String>,
    pub photo_path: Option<String>,
    pub trainer_id: Option<i64>,
    pub trainer_name: Option<String>,    // ФИО тренера (подтягиваем JOIN-ом)
    pub medical_notes: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Данные для создания/обновления клиента (приходят с фронтенда)
#[derive(Debug, Deserialize)]
pub struct ClientFormData {
    pub last_name: String,
    pub first_name: String,
    pub middle_name: Option<String>,
    pub phone: Option<String>,
    pub birth_date: Option<String>,
    pub trainer_id: Option<i64>,
    pub medical_notes: Option<String>,
    pub notes: Option<String>,
}

/// Параметры фильтрации и поиска клиентов
#[derive(Debug, Deserialize)]
pub struct ClientFilters {
    pub search: Option<String>,          // поисковый запрос (ФИО, телефон)
    pub trainer_id: Option<i64>,         // фильтр по тренеру
    pub subscription_status: Option<String>, // фильтр по статусу абонемента
    pub is_active: Option<bool>,         // показывать деактивированных?
    pub page: Option<i64>,               // номер страницы (начиная с 1)
    pub per_page: Option<i64>,           // записей на страницу (по умолчанию 50)
}

/// Ответ со списком клиентов (с пагинацией)
#[derive(Debug, Serialize)]
pub struct ClientListResponse {
    pub clients: Vec<ClientListItem>,    // список клиентов на текущей странице
    pub total: i64,                      // общее количество (для пагинации)
    pub page: i64,                       // текущая страница
    pub per_page: i64,                   // записей на странице
}

/// Краткая информация о клиенте — для отображения в таблице
/// (не тянем все поля — только нужные для списка)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientListItem {
    pub id: i64,
    pub last_name: String,
    pub first_name: String,
    pub middle_name: Option<String>,
    pub phone: Option<String>,
    pub trainer_name: Option<String>,
    pub subscription_status: Option<String>,  // "active", "expired", "frozen" или None
    pub subscription_end_date: Option<String>, // дата окончания текущего абонемента
    pub last_visit_date: Option<String>,       // дата последнего посещения
    pub is_active: bool,
}

// ============================================================
// Типы абонементов
// ============================================================

/// Тип абонемента (Месяц, Квартал, Разовое и т.д.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionType {
    pub id: i64,
    pub name: String,
    pub duration_days: Option<i64>,      // NULL для бессрочного
    pub price: f64,                      // цена в BYN
    pub is_active: bool,
}

/// Данные для создания/обновления типа абонемента
#[derive(Debug, Deserialize)]
pub struct SubscriptionTypeFormData {
    pub name: String,
    pub duration_days: Option<i64>,
    pub price: f64,
}

// ============================================================
// Абонементы клиентов
// ============================================================

/// Абонемент клиента (конкретная покупка)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: i64,
    pub client_id: i64,
    pub type_id: i64,
    pub type_name: String,               // название типа (подтягиваем JOIN-ом)
    pub start_date: String,
    pub end_date: String,
    pub status: String,                  // "active", "expired", "frozen"
    pub created_at: String,
}

/// Данные для создания абонемента
#[derive(Debug, Deserialize)]
pub struct CreateSubscriptionRequest {
    pub client_id: i64,
    pub type_id: i64,
    pub start_date: String,              // дата начала (ISO 8601)
}

// ============================================================
// Оплаты
// ============================================================

/// Запись об оплате
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: i64,
    pub client_id: i64,
    pub client_name: String,             // ФИО клиента (подтягиваем JOIN-ом)
    pub subscription_id: Option<i64>,
    pub amount: f64,                     // сумма в BYN
    pub payment_date: String,
    pub description: Option<String>,
    pub received_by: Option<i64>,
    pub received_by_name: Option<String>, // кто принял (подтягиваем JOIN-ом)
    pub created_at: String,
}

/// Данные для создания оплаты
#[derive(Debug, Deserialize)]
pub struct CreatePaymentRequest {
    pub client_id: i64,
    pub subscription_id: Option<i64>,
    pub amount: f64,
    pub payment_date: String,
    pub description: Option<String>,
}

/// Фильтры для списка оплат
#[derive(Debug, Deserialize)]
pub struct PaymentFilters {
    pub date_from: Option<String>,       // начало периода
    pub date_to: Option<String>,         // конец периода
    pub client_id: Option<i64>,          // фильтр по клиенту
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

// ============================================================
// Посещения
// ============================================================

/// Запись о посещении
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Visit {
    pub id: i64,
    pub client_id: i64,
    pub client_name: String,             // ФИО клиента (подтягиваем JOIN-ом)
    pub visit_date: String,
    pub check_in_time: String,
    pub check_out_time: Option<String>,
    pub registered_by_name: Option<String>, // кто отметил
}

/// Данные для регистрации посещения
#[derive(Debug, Deserialize)]
pub struct CreateVisitRequest {
    pub client_id: i64,
}

// ============================================================
// Дашборд и статистика
// ============================================================

/// Данные для главного экрана (дашборда)
#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub total_clients: i64,              // всего клиентов
    pub active_subscriptions: i64,       // активных абонементов
    pub visits_today: i64,               // посещений сегодня
    pub revenue_this_month: f64,         // доход за текущий месяц
    pub expiring_soon: Vec<ExpiringSubscription>, // истекающие абонементы
}

/// Клиент с истекающим абонементом (для уведомлений)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpiringSubscription {
    pub client_id: i64,
    pub client_name: String,
    pub subscription_type: String,
    pub end_date: String,
    pub days_left: i64,                  // дней до окончания (отрицательное = уже истёк)
}

/// Статистика посещений за период (для графиков)
#[derive(Debug, Serialize)]
pub struct VisitStats {
    pub date: String,                    // дата (YYYY-MM-DD)
    pub count: i64,                      // количество посещений
}

/// Статистика доходов за период (для графиков)
#[derive(Debug, Serialize)]
pub struct RevenueStats {
    pub month: String,                   // месяц (YYYY-MM)
    pub total: f64,                      // общая сумма
}

// ============================================================
// Настройки
// ============================================================

/// Одна настройка (ключ-значение)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: Option<String>,
}

// ============================================================
// Импорт из Excel
// ============================================================

/// Одна строка из Excel-файла (предпросмотр перед импортом)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreviewRow {
    pub row_number: usize,               // номер строки в Excel
    pub last_name: String,
    pub first_name: String,
    pub middle_name: Option<String>,
    pub phone: Option<String>,
    pub birth_date: Option<String>,
    pub is_valid: bool,                  // прошла ли валидацию
    pub errors: Vec<String>,             // список ошибок (если есть)
}

/// Результат импорта
#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub imported: usize,                 // успешно импортировано
    pub skipped: usize,                  // пропущено (ошибки)
    pub errors: Vec<String>,             // описания ошибок
}