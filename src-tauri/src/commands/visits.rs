// src-tauri/src/commands/visits.rs
//
// Tauri-команды для работы с посещениями:
// - create_visit: отметить посещение клиента
// - get_today_visits: список посещений за сегодня
// - get_client_visits: посещения конкретного клиента
// - checkout_visit: отметить уход клиента
// - get_visit_stats: статистика посещений за период (для графиков)

use tauri::State;
use crate::db::Database;
use crate::models::*;
use crate::utils;

/// Отметить посещение клиента (check-in).
/// Автоматически ставит текущую дату и время.
/// Проверяет: не отмечен ли уже сегодня.
#[tauri::command]
pub fn create_visit(
    state: State<'_, Database>,
    request: CreateVisitRequest,
    registered_by: i64,
) -> Result<Visit, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let today = utils::today_iso();
    let now_time = utils::now_time();
    let now = utils::now_iso();

    // Проверяем: не отмечен ли клиент уже сегодня
    let already_visited: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM visits WHERE client_id = ?1 AND visit_date = ?2",
        rusqlite::params![request.client_id, today],
        |row| row.get(0),
    ).map_err(|e| format!("Ошибка проверки: {}", e))?;

    if already_visited {
        return Err("Клиент уже отмечен сегодня".to_string());
    }

    // Получаем имя клиента для ответа
    let client_name: String = conn.query_row(
        "SELECT last_name || ' ' || first_name FROM clients WHERE id = ?1 AND is_active = 1",
        rusqlite::params![request.client_id],
        |row| row.get(0),
    ).map_err(|_| "Клиент не найден или деактивирован".to_string())?;

    // Создаём запись о посещении
    conn.execute(
        "INSERT INTO visits (client_id, visit_date, check_in_time, registered_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![request.client_id, today, now_time, registered_by, now],
    ).map_err(|e| format!("Ошибка записи посещения: {}", e))?;

    let id = conn.last_insert_rowid();

    // Имя того, кто отметил
    let registered_by_name: Option<String> = conn.query_row(
        "SELECT full_name FROM users WHERE id = ?1",
        rusqlite::params![registered_by],
        |row| row.get(0),
    ).ok();

    Ok(Visit {
        id,
        client_id: request.client_id,
        client_name,
        visit_date: today,
        check_in_time: now_time,
        check_out_time: None,
        registered_by_name,
    })
}

/// Получить список посещений за сегодня (для страницы посещений и дашборда)
#[tauri::command]
pub fn get_today_visits(
    state: State<'_, Database>,
) -> Result<Vec<Visit>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let today = utils::today_iso();

    let mut stmt = conn.prepare(
        "SELECT v.id, v.client_id,
                c.last_name || ' ' || c.first_name as client_name,
                v.visit_date, v.check_in_time, v.check_out_time,
                u.full_name as registered_by_name
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         LEFT JOIN users u ON v.registered_by = u.id
         WHERE v.visit_date = ?1
         ORDER BY v.check_in_time DESC"
    ).map_err(|e| format!("Ошибка запроса: {}", e))?;

    let visits = stmt.query_map(rusqlite::params![today], |row| {
        Ok(Visit {
            id: row.get(0)?,
            client_id: row.get(1)?,
            client_name: row.get(2)?,
            visit_date: row.get(3)?,
            check_in_time: row.get(4)?,
            check_out_time: row.get(5)?,
            registered_by_name: row.get(6)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    Ok(visits.filter_map(|v| v.ok()).collect())
}

/// Получить посещения конкретного клиента (для карточки клиента)
#[tauri::command]
pub fn get_client_visits(
    state: State<'_, Database>,
    client_id: i64,
    limit: Option<i64>,
) -> Result<Vec<Visit>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let max_rows = limit.unwrap_or(100);

    let mut stmt = conn.prepare(
        "SELECT v.id, v.client_id,
                c.last_name || ' ' || c.first_name as client_name,
                v.visit_date, v.check_in_time, v.check_out_time,
                u.full_name as registered_by_name
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         LEFT JOIN users u ON v.registered_by = u.id
         WHERE v.client_id = ?1
         ORDER BY v.visit_date DESC, v.check_in_time DESC
         LIMIT ?2"
    ).map_err(|e| format!("Ошибка запроса: {}", e))?;

    let visits = stmt.query_map(rusqlite::params![client_id, max_rows], |row| {
        Ok(Visit {
            id: row.get(0)?,
            client_id: row.get(1)?,
            client_name: row.get(2)?,
            visit_date: row.get(3)?,
            check_in_time: row.get(4)?,
            check_out_time: row.get(5)?,
            registered_by_name: row.get(6)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    Ok(visits.filter_map(|v| v.ok()).collect())
}

/// Отметить уход клиента (check-out)
#[tauri::command]
pub fn checkout_visit(
    state: State<'_, Database>,
    visit_id: i64,
) -> Result<String, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let now_time = utils::now_time();

    let rows = conn.execute(
        "UPDATE visits SET check_out_time = ?1 WHERE id = ?2 AND check_out_time IS NULL",
        rusqlite::params![now_time, visit_id],
    ).map_err(|e| format!("Ошибка обновления: {}", e))?;

    if rows == 0 {
        return Err("Посещение не найдено или уже отмечен уход".to_string());
    }

    Ok(format!("Уход отмечен в {}", now_time))
}

/// Статистика посещений за период (для графиков на дашборде и в отчётах).
/// Возвращает количество посещений по дням.
#[tauri::command]
pub fn get_visit_stats(
    state: State<'_, Database>,
    date_from: String,
    date_to: String,
) -> Result<Vec<VisitStats>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let mut stmt = conn.prepare(
        "SELECT visit_date, COUNT(*) as count
         FROM visits
         WHERE visit_date >= ?1 AND visit_date <= ?2
         GROUP BY visit_date
         ORDER BY visit_date ASC"
    ).map_err(|e| format!("Ошибка запроса: {}", e))?;

    let stats = stmt.query_map(rusqlite::params![date_from, date_to], |row| {
        Ok(VisitStats {
            date: row.get(0)?,
            count: row.get(1)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    Ok(stats.filter_map(|s| s.ok()).collect())
}