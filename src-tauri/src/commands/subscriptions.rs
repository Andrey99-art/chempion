// src-tauri/src/commands/subscriptions.rs
//
// Tauri-команды для работы с абонементами:
// - get_subscription_types: список типов абонементов
// - create_subscription_type: создать тип
// - update_subscription_type: обновить тип
// - toggle_subscription_type_active: вкл/выкл тип
// - get_client_subscriptions: абонементы клиента
// - create_subscription: создать абонемент клиенту
// - update_expired_subscriptions: обновить статусы истёкших

use tauri::State;
use crate::db::Database;
use crate::models::*;
use crate::utils;

// ============================================================
// Типы абонементов (настройки)
// ============================================================

/// Получить все типы абонементов (для выпадающего списка и настроек)
#[tauri::command]
pub fn get_subscription_types(
    state: State<'_, Database>,
    include_inactive: Option<bool>,
) -> Result<Vec<SubscriptionType>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Если include_inactive = true — показываем все, иначе только активные
    let show_all = include_inactive.unwrap_or(false);

    let sql = if show_all {
        "SELECT id, name, duration_days, price, is_active FROM subscription_types ORDER BY price ASC"
    } else {
        "SELECT id, name, duration_days, price, is_active FROM subscription_types WHERE is_active = 1 ORDER BY price ASC"
    };

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("Ошибка запроса: {}", e))?;

    let types = stmt.query_map([], |row| {
        Ok(SubscriptionType {
            id: row.get(0)?,
            name: row.get(1)?,
            duration_days: row.get(2)?,
            price: row.get(3)?,
            is_active: row.get(4)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    Ok(types.filter_map(|t| t.ok()).collect())
}

/// Создать новый тип абонемента
#[tauri::command]
pub fn create_subscription_type(
    state: State<'_, Database>,
    data: SubscriptionTypeFormData,
) -> Result<SubscriptionType, String> {
    if data.name.trim().is_empty() {
        return Err("Название не может быть пустым".to_string());
    }
    if data.price <= 0.0 {
        return Err("Цена должна быть больше 0".to_string());
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    conn.execute(
        "INSERT INTO subscription_types (name, duration_days, price, is_active) VALUES (?1, ?2, ?3, 1)",
        rusqlite::params![data.name.trim(), data.duration_days, data.price],
    ).map_err(|e| format!("Ошибка создания: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(SubscriptionType {
        id,
        name: data.name.trim().to_string(),
        duration_days: data.duration_days,
        price: data.price,
        is_active: true,
    })
}

/// Обновить тип абонемента
#[tauri::command]
pub fn update_subscription_type(
    state: State<'_, Database>,
    type_id: i64,
    data: SubscriptionTypeFormData,
) -> Result<String, String> {
    if data.name.trim().is_empty() {
        return Err("Название не может быть пустым".to_string());
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    conn.execute(
        "UPDATE subscription_types SET name = ?1, duration_days = ?2, price = ?3 WHERE id = ?4",
        rusqlite::params![data.name.trim(), data.duration_days, data.price, type_id],
    ).map_err(|e| format!("Ошибка обновления: {}", e))?;

    Ok("Тип абонемента обновлён".to_string())
}

/// Включить/выключить тип абонемента
#[tauri::command]
pub fn toggle_subscription_type_active(
    state: State<'_, Database>,
    type_id: i64,
) -> Result<String, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    conn.execute(
        "UPDATE subscription_types SET is_active = NOT is_active WHERE id = ?1",
        rusqlite::params![type_id],
    ).map_err(|e| format!("Ошибка обновления: {}", e))?;

    Ok("Статус изменён".to_string())
}

// ============================================================
// Абонементы клиентов
// ============================================================

/// Получить все абонементы клиента (история)
#[tauri::command]
pub fn get_client_subscriptions(
    state: State<'_, Database>,
    client_id: i64,
) -> Result<Vec<Subscription>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Сначала обновляем статусы истёкших абонементов
    update_expired(&conn)?;

    let mut stmt = conn.prepare(
        "SELECT s.id, s.client_id, s.type_id, st.name as type_name,
                s.start_date, s.end_date, s.status, s.created_at
         FROM subscriptions s
         JOIN subscription_types st ON s.type_id = st.id
         WHERE s.client_id = ?1
         ORDER BY s.end_date DESC"
    ).map_err(|e| format!("Ошибка запроса: {}", e))?;

    let subs = stmt.query_map(rusqlite::params![client_id], |row| {
        Ok(Subscription {
            id: row.get(0)?,
            client_id: row.get(1)?,
            type_id: row.get(2)?,
            type_name: row.get(3)?,
            start_date: row.get(4)?,
            end_date: row.get(5)?,
            status: row.get(6)?,
            created_at: row.get(7)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    Ok(subs.filter_map(|s| s.ok()).collect())
}

/// Создать абонемент клиенту.
/// Автоматически рассчитывает end_date на основе типа абонемента.
#[tauri::command]
pub fn create_subscription(
    state: State<'_, Database>,
    request: CreateSubscriptionRequest,
) -> Result<Subscription, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Получаем тип абонемента для расчёта даты окончания
    let (type_name, duration_days): (String, Option<i64>) = conn.query_row(
        "SELECT name, duration_days FROM subscription_types WHERE id = ?1 AND is_active = 1",
        rusqlite::params![request.type_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|_| "Тип абонемента не найден или неактивен".to_string())?;

    // Рассчитываем дату окончания
    let start = chrono::NaiveDate::parse_from_str(&request.start_date, "%Y-%m-%d")
        .map_err(|_| "Неверный формат даты начала".to_string())?;

    let days = duration_days.unwrap_or(30); // если не указано — 30 дней по умолчанию
    let end = start + chrono::Duration::days(days);
    let end_date = end.format("%Y-%m-%d").to_string();

    let now = utils::now_iso();

    conn.execute(
        "INSERT INTO subscriptions (client_id, type_id, start_date, end_date, status, created_at)
         VALUES (?1, ?2, ?3, ?4, 'active', ?5)",
        rusqlite::params![request.client_id, request.type_id, request.start_date, end_date, now],
    ).map_err(|e| format!("Ошибка создания абонемента: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(Subscription {
        id,
        client_id: request.client_id,
        type_id: request.type_id,
        type_name,
        start_date: request.start_date,
        end_date,
        status: "active".to_string(),
        created_at: now,
    })
}

/// Обновить статусы истёкших абонементов (active → expired).
/// Вызывается автоматически при загрузке списка абонементов.
#[tauri::command]
pub fn update_expired_subscriptions(
    state: State<'_, Database>,
) -> Result<i64, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    update_expired(&conn)
}

// === Вспомогательная функция ===

/// Обновляет статусы: если end_date < сегодня и статус active → меняем на expired
fn update_expired(conn: &rusqlite::Connection) -> Result<i64, String> {
    let today = utils::today_iso();

    let updated = conn.execute(
        "UPDATE subscriptions SET status = 'expired' WHERE status = 'active' AND end_date < ?1",
        rusqlite::params![today],
    ).map_err(|e| format!("Ошибка обновления статусов: {}", e))?;

    Ok(updated as i64)
}