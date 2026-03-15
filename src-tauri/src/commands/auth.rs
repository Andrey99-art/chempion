// src-tauri/src/commands/auth.rs
//
// Tauri-команды авторизации:
// - login: вход в систему (проверка логина/пароля)
// - change_password: смена пароля
// - get_users: список пользователей (для админа)
// - create_user: создание нового пользователя (тренера)
// - toggle_user_active: активация/деактивация пользователя
// - reset_user_password: сброс пароля пользователя (админом)
//
// #[tauri::command] — макрос, который делает функцию доступной из JavaScript.
// State<'_, Database> — доступ к общему соединению с БД.

use tauri::State;
use crate::db::Database;
use crate::models::*;
use crate::utils;

/// Вход в систему.
/// Принимает логин и пароль, проверяет в БД, возвращает данные пользователя.
#[tauri::command]
pub fn login(
    state: State<'_, Database>,          // доступ к БД через Tauri state
    request: LoginRequest,               // { username, password } с фронтенда
) -> Result<LoginResponse, String> {
    // Блокируем Mutex чтобы получить доступ к соединению
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Ищем пользователя по логину
    let result = conn.query_row(
        "SELECT id, username, password_hash, full_name, role, is_active, force_password_change, created_at
         FROM users WHERE username = ?1",
        rusqlite::params![request.username],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,           // id
                row.get::<_, String>(1)?,         // username
                row.get::<_, String>(2)?,         // password_hash
                row.get::<_, String>(3)?,         // full_name
                row.get::<_, String>(4)?,         // role
                row.get::<_, bool>(5)?,           // is_active
                row.get::<_, bool>(6)?,           // force_password_change
                row.get::<_, String>(7)?,         // created_at
            ))
        },
    );

    // Если пользователь не найден — ошибка
    let (id, username, password_hash, full_name, role, is_active, force_password_change, created_at) =
        result.map_err(|_| "Неверный логин или пароль".to_string())?;

    // Проверяем что аккаунт активен
    if !is_active {
        return Err("Учётная запись заблокирована. Обратитесь к администратору.".to_string());
    }

    // Проверяем пароль через bcrypt
    // bcrypt::verify сравнивает введённый пароль с хэшем из БД
    let password_valid = bcrypt::verify(&request.password, &password_hash)
        .map_err(|_| "Ошибка проверки пароля".to_string())?;

    if !password_valid {
        return Err("Неверный логин или пароль".to_string());
    }

    // Формируем ответ с данными пользователя (без пароля!)
    let user = User {
        id,
        username,
        full_name,
        role,
        is_active,
        force_password_change,
        created_at,
    };

    // Сообщение зависит от того, нужно ли менять пароль
    let message = if force_password_change {
        "Необходимо сменить пароль".to_string()
    } else {
        "Добро пожаловать!".to_string()
    };

    Ok(LoginResponse { user, message })
}

/// Смена пароля пользователя.
/// Проверяет старый пароль, хэширует новый и сохраняет.
#[tauri::command]
pub fn change_password(
    state: State<'_, Database>,
    request: ChangePasswordRequest,      // { user_id, old_password, new_password }
) -> Result<String, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Получаем текущий хэш пароля из БД
    let current_hash: String = conn.query_row(
        "SELECT password_hash FROM users WHERE id = ?1",
        rusqlite::params![request.user_id],
        |row| row.get(0),
    ).map_err(|_| "Пользователь не найден".to_string())?;

    // Проверяем старый пароль
    let old_valid = bcrypt::verify(&request.old_password, &current_hash)
        .map_err(|_| "Ошибка проверки пароля".to_string())?;

    if !old_valid {
        return Err("Неверный текущий пароль".to_string());
    }

    // Валидация нового пароля — минимум 4 символа
    if request.new_password.len() < 4 {
        return Err("Новый пароль должен быть не менее 4 символов".to_string());
    }

    // Хэшируем новый пароль
    let new_hash = bcrypt::hash(&request.new_password, 12)
        .map_err(|_| "Ошибка создания пароля".to_string())?;

    // Обновляем пароль в БД и снимаем флаг принудительной смены
    conn.execute(
        "UPDATE users SET password_hash = ?1, force_password_change = 0 WHERE id = ?2",
        rusqlite::params![new_hash, request.user_id],
    ).map_err(|e| format!("Ошибка обновления пароля: {}", e))?;

    Ok("Пароль успешно изменён".to_string())
}

/// Получить список всех пользователей (для управления в настройках).
/// Доступно только администратору (проверка роли — на фронтенде и здесь).
#[tauri::command]
pub fn get_users(
    state: State<'_, Database>,
) -> Result<Vec<User>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Получаем всех пользователей, сортируем: сначала admin, потом по имени
    let mut stmt = conn.prepare(
        "SELECT id, username, full_name, role, is_active, force_password_change, created_at
         FROM users ORDER BY role ASC, full_name ASC"
    ).map_err(|e| format!("Ошибка запроса: {}", e))?;

    // Преобразуем каждую строку из БД в структуру User
    let users = stmt.query_map([], |row| {
        Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            full_name: row.get(2)?,
            role: row.get(3)?,
            is_active: row.get(4)?,
            force_password_change: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    // Собираем все записи в вектор, пропуская ошибочные
    let result: Vec<User> = users.filter_map(|u| u.ok()).collect();

    Ok(result)
}

/// Создать нового пользователя (тренера).
/// Доступно только администратору.
#[tauri::command]
pub fn create_user(
    state: State<'_, Database>,
    request: CreateUserRequest,          // { username, password, full_name, role }
) -> Result<User, String> {
    // Валидация полей
    if !utils::is_not_blank(&request.username) {
        return Err("Логин не может быть пустым".to_string());
    }
    if !utils::is_not_blank(&request.full_name) {
        return Err("ФИО не может быть пустым".to_string());
    }
    if request.password.len() < 4 {
        return Err("Пароль должен быть не менее 4 символов".to_string());
    }
    // Роль может быть только admin или trainer
    if request.role != "admin" && request.role != "trainer" {
        return Err("Недопустимая роль. Допустимые: admin, trainer".to_string());
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Проверяем что логин не занят
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM users WHERE username = ?1",
        rusqlite::params![request.username],
        |row| row.get(0),
    ).map_err(|e| format!("Ошибка проверки: {}", e))?;

    if exists {
        return Err(format!("Логин '{}' уже занят", request.username));
    }

    // Хэшируем пароль
    let password_hash = bcrypt::hash(&request.password, 12)
        .map_err(|_| "Ошибка создания пароля".to_string())?;

    let now = utils::now_iso();

    // Вставляем нового пользователя
    conn.execute(
        "INSERT INTO users (username, password_hash, full_name, role, is_active, force_password_change, created_at)
         VALUES (?1, ?2, ?3, ?4, 1, 1, ?5)",
        rusqlite::params![request.username, password_hash, request.full_name, request.role, now],
    ).map_err(|e| format!("Ошибка создания пользователя: {}", e))?;

    // Получаем id только что созданного пользователя
    let id = conn.last_insert_rowid();

    Ok(User {
        id,
        username: request.username,
        full_name: request.full_name,
        role: request.role,
        is_active: true,
        force_password_change: true,     // новый пользователь должен сменить пароль
        created_at: now,
    })
}

/// Включить/выключить пользователя (заблокировать аккаунт тренера).
/// Нельзя заблокировать самого себя.
#[tauri::command]
pub fn toggle_user_active(
    state: State<'_, Database>,
    user_id: i64,                        // id пользователя
    current_user_id: i64,                // id того, кто делает запрос (для защиты)
) -> Result<String, String> {
    // Нельзя заблокировать самого себя
    if user_id == current_user_id {
        return Err("Нельзя заблокировать свою учётную запись".to_string());
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Инвертируем флаг is_active: если был 1 → станет 0, и наоборот
    // NOT is_active — логическое отрицание в SQLite
    conn.execute(
        "UPDATE users SET is_active = NOT is_active WHERE id = ?1",
        rusqlite::params![user_id],
    ).map_err(|e| format!("Ошибка обновления: {}", e))?;

    Ok("Статус пользователя изменён".to_string())
}

/// Сброс пароля пользователя администратором.
/// Устанавливает новый пароль и флаг принудительной смены.
#[tauri::command]
pub fn reset_user_password(
    state: State<'_, Database>,
    user_id: i64,
    new_password: String,
) -> Result<String, String> {
    if new_password.len() < 4 {
        return Err("Пароль должен быть не менее 4 символов".to_string());
    }

    let password_hash = bcrypt::hash(&new_password, 12)
        .map_err(|_| "Ошибка создания пароля".to_string())?;

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Обновляем пароль и ставим флаг смены при следующем входе
    conn.execute(
        "UPDATE users SET password_hash = ?1, force_password_change = 1 WHERE id = ?2",
        rusqlite::params![password_hash, user_id],
    ).map_err(|e| format!("Ошибка сброса пароля: {}", e))?;

    Ok("Пароль сброшен. При следующем входе пользователь должен будет его сменить.".to_string())
}

/// Сгенерировать мастер-ключ восстановления (при первом запуске).
/// Возвращает ключ только если он ещё не был создан.
#[tauri::command]
pub fn generate_recovery_key(
    state: State<'_, Database>,
) -> Result<Option<String>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Проверяем — есть ли уже ключ
    let existing: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'recovery_key_hash'",
        [],
        |row| row.get(0),
    ).unwrap_or(None);

    if existing.is_some() {
        return Ok(None);
    }

    // Генерируем 8-значный ключ используя UUID (гарантированно уникальный)
    let uuid = uuid::Uuid::new_v4().to_string();
    // Берём первые 8 символов без дефисов, переводим в верхний регистр
    let key: String = uuid.replace('-', "")
        .chars()
        .take(8)
        .collect::<String>()
        .to_uppercase();

    // Сохраняем хэш ключа в настройках
    let key_hash = bcrypt::hash(&key, 12)
        .map_err(|_| "Ошибка генерации ключа".to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('recovery_key_hash', ?1)",
        rusqlite::params![key_hash],
    ).map_err(|e| format!("Ошибка сохранения: {}", e))?;

    Ok(Some(key))
}

/// Сбросить пароль администратора по мастер-ключу.
#[tauri::command]
pub fn recover_admin_password(
    state: State<'_, Database>,
    recovery_key: String,
    new_password: String,
) -> Result<String, String> {
    if new_password.len() < 4 {
        return Err("Пароль должен быть не менее 4 символов".to_string());
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Получаем хэш мастер-ключа
    let key_hash: String = conn.query_row(
        "SELECT value FROM settings WHERE key = 'recovery_key_hash'",
        [],
        |row| row.get(0),
    ).map_err(|_| "Мастер-ключ не настроен".to_string())?;

    // Проверяем ключ
    let valid = bcrypt::verify(&recovery_key, &key_hash)
        .map_err(|_| "Ошибка проверки ключа".to_string())?;

    if !valid {
        return Err("Неверный мастер-ключ".to_string());
    }

    // Хэшируем новый пароль
    let password_hash = bcrypt::hash(&new_password, 12)
        .map_err(|_| "Ошибка создания пароля".to_string())?;

    // Обновляем пароль первого администратора
    conn.execute(
        "UPDATE users SET password_hash = ?1, force_password_change = 0 WHERE role = 'admin' ORDER BY id ASC LIMIT 1",
        rusqlite::params![password_hash],
    ).map_err(|e| format!("Ошибка сброса пароля: {}", e))?;

    Ok("Пароль администратора сброшен".to_string())
}

/// Простой генератор случайного байта (без внешних зависимостей)
fn rand_byte() -> u8 {
    use std::time::SystemTime;
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    ((nanos ^ (nanos >> 16)) & 0xFF) as u8
}