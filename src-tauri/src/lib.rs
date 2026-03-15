// src-tauri/src/lib.rs
//
// Точка входа Tauri-приложения.
// Здесь:
// - Подключаем все модули (db, commands, models, utils)
// - Инициализируем базу данных
// - Регистрируем Tauri-команды (делаем их доступными из JavaScript)
// - Подключаем плагины (диалоги, файловая система)
// - Запускаем приложение

// Подключение модулей нашего приложения
mod db;          // база данных: подключение, схема, миграции
mod commands;    // Tauri-команды: auth, clients, payments и т.д.
mod models;      // структуры данных: User, Client, Payment и т.д.
mod utils;       // вспомогательные функции: даты, пути, валидация

// Макрос для мобильной точки входа (нам не нужен, но Tauri требует)
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Инициализируем базу данных при запуске
    // Если БД не удалось создать — приложение не запустится (это критическая ошибка)
    let database = db::init_database()
        .expect("Критическая ошибка: не удалось инициализировать базу данных");

    tauri::Builder::default()
        // --- Плагины ---
        // Плагин для открытия файлов и ссылок через системные средства
        .plugin(tauri_plugin_opener::init())
        // Плагин для системных диалогов (выбор файла, папки, подтверждение)
        .plugin(tauri_plugin_dialog::init())
        // Плагин для доступа к файловой системе
        .plugin(tauri_plugin_fs::init())

        // --- Состояние приложения ---
        // Помещаем базу данных в Tauri State — она будет доступна во всех командах
        // через параметр State<'_, Database>
        .manage(database)

        // --- Регистрация команд ---
        // Каждая команда из commands::auth становится доступной из JavaScript
        // через вызов: await invoke("login", { request: {...} })
        .invoke_handler(tauri::generate_handler![
            // Авторизация
            commands::auth::login,
            commands::auth::change_password,
            commands::auth::get_users,
            commands::auth::create_user,
            commands::auth::toggle_user_active,
            commands::auth::reset_user_password,
            commands::auth::generate_recovery_key,
            commands::auth::recover_admin_password,
             // Клиенты
            commands::clients::get_clients,
            commands::clients::get_client,
            commands::clients::create_client,
            commands::clients::update_client,
            commands::clients::toggle_client_active,
            commands::clients::search_clients_quick,
            commands::clients::get_trainers,
            // Абонементы
            commands::subscriptions::get_subscription_types,
            commands::subscriptions::create_subscription_type,
            commands::subscriptions::update_subscription_type,
            commands::subscriptions::toggle_subscription_type_active,
            commands::subscriptions::get_client_subscriptions,
            commands::subscriptions::create_subscription,
            commands::subscriptions::update_expired_subscriptions,
            // Оплаты
            commands::payments::get_client_payments,
            commands::payments::get_payments,
            commands::payments::create_payment,
            commands::payments::get_payments_total,
            // Посещения
            commands::visits::create_visit,
            commands::visits::get_today_visits,
            commands::visits::get_client_visits,
            commands::visits::checkout_visit,
            commands::visits::get_visit_stats,
            // Отчёты и дашборд
            commands::reports::get_dashboard_data,
            commands::reports::get_revenue_stats,
            // Импорт
            commands::import::preview_import,
            commands::import::execute_import,
            commands::import::get_excel_columns,
            // Экспорт
            commands::export::export_clients,
            commands::export::export_payments,
            // Бэкап
            commands::backup::get_db_info,
            commands::backup::create_backup,
            commands::backup::restore_backup,
            // Настройки
            commands::settings::upload_logo,
            commands::settings::get_logo_base64,
            commands::settings::get_setting,
            commands::settings::set_setting, 
            commands::settings::upload_client_photo,
            commands::settings::get_client_photo_base64,
            // Тренировки
            commands::workouts::get_exercises,
            commands::workouts::create_exercise,
            commands::workouts::get_workout_templates,
            commands::workouts::create_workout_template,
            commands::workouts::get_client_workouts,
            commands::workouts::create_workout,
        ])

        // Запуск приложения
        .run(tauri::generate_context!())
        .expect("Ошибка запуска приложения");
}