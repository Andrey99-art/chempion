// src-tauri/src/db/schema.rs
//
// Создание всех таблиц, индексов и полнотекстового поиска (FTS5).
// Вызывается один раз при первом запуске приложения.

use rusqlite::Connection;

/// Создаёт все таблицы базы данных
pub fn create_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'trainer')),
            is_active INTEGER DEFAULT 1,
            force_password_change INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );"
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            last_name TEXT NOT NULL,
            first_name TEXT NOT NULL,
            middle_name TEXT,
            phone TEXT,
            birth_date TEXT,
            photo_path TEXT,
            trainer_id INTEGER REFERENCES users(id),
            medical_notes TEXT,
            notes TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );"
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS subscription_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            duration_days INTEGER,
            price REAL NOT NULL,
            is_active INTEGER DEFAULT 1
        );"
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id),
            type_id INTEGER NOT NULL REFERENCES subscription_types(id),
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT DEFAULT 'active'
                CHECK(status IN ('active', 'expired', 'frozen')),
            created_at TEXT NOT NULL
        );"
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id),
            subscription_id INTEGER REFERENCES subscriptions(id),
            amount REAL NOT NULL,
            payment_date TEXT NOT NULL,
            description TEXT,
            received_by INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL
        );"
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id),
            visit_date TEXT NOT NULL,
            check_in_time TEXT NOT NULL,
            check_out_time TEXT,
            registered_by INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL
        );"
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );"
    )?;

    // --- Таблицы тренировок ---

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            muscle_group TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        );"
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS workout_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            trainer_id INTEGER REFERENCES users(id),
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        );"
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS workout_template_exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL REFERENCES workout_templates(id),
            exercise_id INTEGER NOT NULL REFERENCES exercises(id),
            order_index INTEGER DEFAULT 0,
            default_sets INTEGER DEFAULT 3,
            default_reps INTEGER DEFAULT 10,
            notes TEXT
        );"
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS workouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id),
            trainer_id INTEGER REFERENCES users(id),
            template_id INTEGER REFERENCES workout_templates(id),
            workout_date TEXT NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL
        );"
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS workout_exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workout_id INTEGER NOT NULL REFERENCES workouts(id),
            exercise_id INTEGER NOT NULL REFERENCES exercises(id),
            order_index INTEGER DEFAULT 0,
            sets_data TEXT NOT NULL,
            notes TEXT
        );"
    )?;

    Ok(())
}

/// Создаёт индексы для ускорения частых запросов
pub fn create_indexes(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_clients_name
            ON clients(last_name, first_name);

        CREATE INDEX IF NOT EXISTS idx_clients_trainer
            ON clients(trainer_id);

        CREATE INDEX IF NOT EXISTS idx_subscriptions_client_status
            ON subscriptions(client_id, status);

        CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date
            ON subscriptions(end_date);

        CREATE INDEX IF NOT EXISTS idx_visits_client_date
            ON visits(client_id, visit_date);

        CREATE INDEX IF NOT EXISTS idx_payments_client_date
            ON payments(client_id, payment_date);

        CREATE INDEX IF NOT EXISTS idx_visits_date
            ON visits(visit_date);

        CREATE INDEX IF NOT EXISTS idx_payments_date
            ON payments(payment_date);

        CREATE INDEX IF NOT EXISTS idx_workouts_client_date
            ON workouts(client_id, workout_date);

        CREATE INDEX IF NOT EXISTS idx_workouts_trainer
            ON workouts(trainer_id);
        "
    )?;

    Ok(())
}

/// Создаёт виртуальную таблицу FTS5 для мгновенного поиска клиентов
pub fn create_fts(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS clients_fts USING fts5(
            last_name,
            first_name,
            middle_name,
            phone,
            content=clients,
            content_rowid=id
        );"
    )?;

    conn.execute_batch(
        "CREATE TRIGGER IF NOT EXISTS clients_fts_insert AFTER INSERT ON clients BEGIN
            INSERT INTO clients_fts(rowid, last_name, first_name, middle_name, phone)
            VALUES (new.id, new.last_name, new.first_name, new.middle_name, new.phone);
        END;"
    )?;

    conn.execute_batch(
        "CREATE TRIGGER IF NOT EXISTS clients_fts_update AFTER UPDATE ON clients BEGIN
            INSERT INTO clients_fts(clients_fts, rowid, last_name, first_name, middle_name, phone)
            VALUES ('delete', old.id, old.last_name, old.first_name, old.middle_name, old.phone);
            INSERT INTO clients_fts(rowid, last_name, first_name, middle_name, phone)
            VALUES (new.id, new.last_name, new.first_name, new.middle_name, new.phone);
        END;"
    )?;

    conn.execute_batch(
        "CREATE TRIGGER IF NOT EXISTS clients_fts_delete AFTER DELETE ON clients BEGIN
            INSERT INTO clients_fts(clients_fts, rowid, last_name, first_name, middle_name, phone)
            VALUES ('delete', old.id, old.last_name, old.first_name, old.middle_name, old.phone);
        END;"
    )?;

    Ok(())
}

/// Вставляет начальные настройки приложения
pub fn insert_default_settings(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        INSERT OR IGNORE INTO settings (key, value) VALUES ('gym_name', 'Чемпион');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('notification_days_before', '3');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_backup_enabled', '0');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_backup_path', '');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'light');
        "
    )?;

    Ok(())
}

/// Вставляет стандартные типы абонементов
pub fn insert_default_subscription_types(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM subscription_types",
        [],
        |row| row.get(0),
    )?;

    if count == 0 {
        conn.execute_batch(
            "
            INSERT INTO subscription_types (name, duration_days, price) VALUES ('Разовое посещение', 1, 10.00);
            INSERT INTO subscription_types (name, duration_days, price) VALUES ('Месяц', 30, 50.00);
            INSERT INTO subscription_types (name, duration_days, price) VALUES ('Квартал (3 месяца)', 90, 130.00);
            INSERT INTO subscription_types (name, duration_days, price) VALUES ('Полгода', 180, 240.00);
            INSERT INTO subscription_types (name, duration_days, price) VALUES ('Год', 365, 450.00);
            INSERT INTO subscription_types (name, duration_days, price) VALUES ('Персональная тренировка', 1, 25.00);
            "
        )?;
    }

    Ok(())
}

/// Вставляет стандартные упражнения
pub fn insert_default_exercises(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM exercises",
        [],
        |row| row.get(0),
    )?;

    if count == 0 {
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        let exercises = [
            ("Жим лёжа", "Грудь"),
            ("Жим гантелей лёжа", "Грудь"),
            ("Разводка гантелей", "Грудь"),
            ("Отжимания на брусьях", "Грудь"),
            ("Приседания со штангой", "Ноги"),
            ("Жим ногами", "Ноги"),
            ("Выпады", "Ноги"),
            ("Разгибание ног", "Ноги"),
            ("Сгибание ног", "Ноги"),
            ("Становая тяга", "Спина"),
            ("Подтягивания", "Спина"),
            ("Тяга штанги в наклоне", "Спина"),
            ("Тяга верхнего блока", "Спина"),
            ("Тяга нижнего блока", "Спина"),
            ("Жим стоя (армейский)", "Плечи"),
            ("Махи гантелей в стороны", "Плечи"),
            ("Тяга к подбородку", "Плечи"),
            ("Подъём штанги на бицепс", "Руки"),
            ("Подъём гантелей на бицепс", "Руки"),
            ("Французский жим", "Руки"),
            ("Разгибание на трицепс", "Руки"),
            ("Скручивания", "Пресс"),
            ("Планка", "Пресс"),
            ("Подъём ног в висе", "Пресс"),
            ("Гиперэкстензия", "Спина"),
        ];

        for (name, group) in &exercises {
            conn.execute(
                "INSERT INTO exercises (name, muscle_group, is_active, created_at) VALUES (?1, ?2, 1, ?3)",
                rusqlite::params![name, group, now],
            )?;
        }
    }

    Ok(())
}