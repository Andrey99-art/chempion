// src-tauri/src/commands/mod.rs
//
// Реэкспорт всех модулей команд.

pub mod auth;          // авторизация: логин, смена пароля, управление пользователями
pub mod clients;       // CRUD клиентов, поиск, фильтры
pub mod subscriptions; // абонемент клиента
pub mod payments;      // раздел оплаты для клиента
pub mod visits;        // трекинг посещений клиента
pub mod reports;       // агрегация данных для дашборда
pub mod import;        // для импорта клиентов из Excel
pub mod export;        // создаёт экспорт данных в Excel
pub mod backup;        // бэкап базы данных и восстановление
pub mod settings;      // для загрузки логотипа в Настройках
pub mod workouts;      // тренировки клиентов