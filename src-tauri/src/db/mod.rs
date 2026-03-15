// src-tauri/src/db/mod.rs
//
// Инициализация базы данных SQLite.
// - Определяет путь к файлу БД (в AppData на Windows, в ~/.local/share на Linux)
// - Открывает соединение
// - Включает WAL mode (защита от потери данных при сбое)
// - Создаёт таблицы, индексы, FTS5
// - Запускает миграции
// - Создаёт начального администратора

// Подключаем подмодули
pub mod schema;
pub mod migrations;

use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

/// Обёртка над соединением SQLite в Mutex.
/// Mutex нужен потому что Tauri — многопоточный:
/// несколько команд могут обращаться к БД одновременно,
/// а SQLite не любит параллельную запись.
pub struct Database {
    pub conn: Mutex<Connection>,
}

/// Определяет путь к файлу базы данных.
/// На Windows: C:\Users\<user>\AppData\Roaming\com.champion.gym\gym_champion.db
/// На Linux: ~/.local/share/com.champion.gym/gym_champion.db
/// Данные хранятся ОТДЕЛЬНО от приложения — при обновлении .msi база не затрагивается.
fn get_db_path() -> PathBuf {
    // dirs::data_dir() возвращает системную папку для данных приложений
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from(".")) // если не удалось — текущая папка (запасной вариант)
        .join("com.champion.gym");

    // Создаём папку если она не существует (первый запуск)
    fs::create_dir_all(&data_dir).expect("Не удалось создать папку для базы данных");

    data_dir.join("gym_champion.db")
}

/// Инициализирует базу данных: открывает файл, настраивает, создаёт таблицы.
/// Возвращает Database — обёртку с Mutex для безопасного многопоточного доступа.
pub fn init_database() -> Result<Database, String> {
    let db_path = get_db_path();

    // Открываем соединение (файл создаётся автоматически если не существует)
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Не удалось открыть базу данных: {}", e))?;

    // --- Настройки SQLite для надёжности и производительности ---

    // WAL mode (Write-Ahead Logging) — защита от потери данных при сбое.
    // Запись идёт сначала в лог, потом в основной файл.
    // Если питание отключится во время записи — данные не повредятся.
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Не удалось включить WAL: {}", e))?;

    // Включаем проверку внешних ключей (REFERENCES).
    // По умолчанию SQLite НЕ проверяет их — нужно включать явно.
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Не удалось включить foreign keys: {}", e))?;

    // Режим синхронизации NORMAL — компромисс между скоростью и надёжностью.
    // FULL — максимально надёжно, но медленнее.
    // NORMAL + WAL — достаточно надёжно для нашего случая.
    conn.execute_batch("PRAGMA synchronous=NORMAL;")
        .map_err(|e| format!("Не удалось установить synchronous: {}", e))?;

    // --- Создание структуры БД ---

    // Создаём все таблицы (IF NOT EXISTS — безопасно вызывать повторно)
    schema::create_tables(&conn)
        .map_err(|e| format!("Ошибка создания таблиц: {}", e))?;

    // Создаём индексы для быстрого поиска и фильтрации
    schema::create_indexes(&conn)
        .map_err(|e| format!("Ошибка создания индексов: {}", e))?;

    // Создаём FTS5 (полнотекстовый поиск) + триггеры синхронизации
    schema::create_fts(&conn)
        .map_err(|e| format!("Ошибка создания FTS5: {}", e))?;

    // Вставляем настройки по умолчанию (если их ещё нет)
    schema::insert_default_settings(&conn)
        .map_err(|e| format!("Ошибка вставки настроек: {}", e))?;

    // Вставляем стандартные типы абонементов (если таблица пустая)
    schema::insert_default_subscription_types(&conn)
        .map_err(|e| format!("Ошибка вставки типов абонементов: {}", e))?;

    schema::insert_default_exercises(&conn)
        .map_err(|e| format!("Ошибка вставки упражнений: {}", e))?;

    // Применяем миграции (обновление схемы при обновлении приложения)
    migrations::run_migrations(&conn)
        .map_err(|e| format!("Ошибка миграций: {}", e))?;

    // Аварийный сброс admin (если файл RESET_ADMIN существует)
    check_emergency_reset(&conn)?;

    // Создаём начального администратора (admin/admin) если пользователей нет
    create_default_admin(&conn)?;

    Ok(Database {
        conn: Mutex::new(conn),
    })
}

/// Создаёт учётную запись администратора по умолчанию при первом запуске.
/// Логин: admin, пароль: admin (с флагом принудительной смены пароля).
fn create_default_admin(conn: &Connection) -> Result<(), String> {
    // Проверяем, есть ли хоть один пользователь
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users",
        [],
        |row| row.get(0),
    ).map_err(|e| format!("Ошибка проверки пользователей: {}", e))?;

    // Если пользователи уже есть — ничего не делаем
    if count > 0 {
        return Ok(());
    }

    // Хэшируем пароль "admin" через bcrypt (cost = 12 — стандартная стойкость)
    let password_hash = bcrypt::hash("admin", 12)
        .map_err(|e| format!("Ошибка хэширования пароля: {}", e))?;

    // Текущее время в формате ISO 8601
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();

    // Вставляем администратора с флагом force_password_change = 1
    conn.execute(
        "INSERT INTO users (username, password_hash, full_name, role, is_active, force_password_change, created_at)
         VALUES (?1, ?2, ?3, ?4, 1, 1, ?5)",
        rusqlite::params!["admin", password_hash, "Администратор", "admin", now],
    ).map_err(|e| format!("Ошибка создания администратора: {}", e))?;

    Ok(())
}

/// Аварийный сброс пароля администратора.
/// Если в папке данных приложения лежит файл RESET_ADMIN —
/// сбрасываем пароль admin на "admin" и удаляем файл.
/// Это позволяет восстановить доступ без мастер-ключа.
fn check_emergency_reset(conn: &Connection) -> Result<(), String> {
    let reset_file = get_db_path().parent()
        .unwrap_or(std::path::Path::new("."))
        .join("RESET_ADMIN");

    if !reset_file.exists() {
        return Ok(());
    }

    // Файл существует — сбрасываем пароль admin
    let password_hash = bcrypt::hash("admin", 12)
        .map_err(|e| format!("Ошибка хэширования: {}", e))?;

    conn.execute(
        "UPDATE users SET password_hash = ?1, force_password_change = 1 WHERE role = 'admin' ORDER BY id ASC LIMIT 1",
        rusqlite::params![password_hash],
    ).map_err(|e| format!("Ошибка сброса: {}", e))?;

    // Удаляем мастер-ключ (чтобы сгенерировался новый)
    conn.execute(
        "DELETE FROM settings WHERE key = 'recovery_key_hash'",
        [],
    ).ok();

    // Удаляем файл-маркер
    fs::remove_file(&reset_file).ok();

    Ok(())
}