// src-tauri/src/commands/reports.rs
//
// Tauri-команды для дашборда и отчётов:
// - get_dashboard_data: все данные для главного экрана
// - get_revenue_stats: статистика доходов по месяцам

use tauri::State;
use crate::db::Database;
use crate::models::*;
use crate::utils;

/// Получить все данные для дашборда одним запросом.
/// Возвращает: счётчики, истекающие абонементы.
#[tauri::command]
pub fn get_dashboard_data(
    state: State<'_, Database>,
    notification_days: Option<i64>,
) -> Result<DashboardData, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let today = utils::today_iso();
    let first_of_month = utils::first_day_of_month();
    let days_ahead = notification_days.unwrap_or(7);

    // 1. Всего активных клиентов
    let total_clients: i64 = conn.query_row(
        "SELECT COUNT(*) FROM clients WHERE is_active = 1",
        [],
        |row| row.get(0),
    ).map_err(|e| format!("Ошибка: {}", e))?;

    // 2. Активных абонементов (end_date >= сегодня и статус active)
    let active_subscriptions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND end_date >= ?1",
        rusqlite::params![today],
        |row| row.get(0),
    ).map_err(|e| format!("Ошибка: {}", e))?;

    // 3. Посещений сегодня
    let visits_today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM visits WHERE visit_date = ?1",
        rusqlite::params![today],
        |row| row.get(0),
    ).map_err(|e| format!("Ошибка: {}", e))?;

    // 4. Доход за текущий месяц
    let revenue_this_month: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM payments WHERE payment_date >= ?1",
        rusqlite::params![first_of_month],
        |row| row.get(0),
    ).map_err(|e| format!("Ошибка: {}", e))?;

    // 5. Истекающие абонементы (в ближайшие N дней + уже истёкшие за последние 7 дней)
    let expiring_soon = get_expiring_subscriptions(&conn, &today, days_ahead)?;

    Ok(DashboardData {
        total_clients,
        active_subscriptions,
        visits_today,
        revenue_this_month,
        expiring_soon,
    })
}

/// Получить статистику доходов по месяцам (для графиков)
#[tauri::command]
pub fn get_revenue_stats(
    state: State<'_, Database>,
    months_back: Option<i64>,
) -> Result<Vec<RevenueStats>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let count = months_back.unwrap_or(12);

    // Группируем оплаты по месяцам (YYYY-MM)
    let mut stmt = conn.prepare(
        "SELECT strftime('%Y-%m', payment_date) as month, SUM(amount) as total
         FROM payments
         GROUP BY month
         ORDER BY month DESC
         LIMIT ?1"
    ).map_err(|e| format!("Ошибка запроса: {}", e))?;

    let stats = stmt.query_map(rusqlite::params![count], |row| {
        Ok(RevenueStats {
            month: row.get(0)?,
            total: row.get(1)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    // Собираем и разворачиваем (чтобы старые месяцы были первыми)
    let mut result: Vec<RevenueStats> = stats.filter_map(|s| s.ok()).collect();
    result.reverse();

    Ok(result)
}

// === Вспомогательные функции ===

/// Получить список клиентов с истекающими абонементами
fn get_expiring_subscriptions(
    conn: &rusqlite::Connection,
    today: &str,
    days_ahead: i64,
) -> Result<Vec<ExpiringSubscription>, String> {
    // Считаем дату "через N дней"
    let future_date = chrono::NaiveDate::parse_from_str(today, "%Y-%m-%d")
        .map_err(|_| "Ошибка парсинга даты".to_string())?;
    let end_date = future_date + chrono::Duration::days(days_ahead);
    let end_date_str = end_date.format("%Y-%m-%d").to_string();

    // Также показываем абонементы, истёкшие за последние 7 дней
    let past_date = future_date - chrono::Duration::days(7);
    let past_date_str = past_date.format("%Y-%m-%d").to_string();

    let mut stmt = conn.prepare(
        "SELECT s.client_id,
                c.last_name || ' ' || c.first_name as client_name,
                st.name as subscription_type,
                s.end_date,
                CAST(julianday(s.end_date) - julianday(?1) AS INTEGER) as days_left
         FROM subscriptions s
         JOIN clients c ON s.client_id = c.id
         JOIN subscription_types st ON s.type_id = st.id
         WHERE c.is_active = 1
           AND s.end_date >= ?2
           AND s.end_date <= ?3
           AND s.id = (
               SELECT s2.id FROM subscriptions s2
               WHERE s2.client_id = s.client_id
               ORDER BY s2.end_date DESC LIMIT 1
           )
         ORDER BY s.end_date ASC"
    ).map_err(|e| format!("Ошибка запроса: {}", e))?;

    let expiring = stmt.query_map(
        rusqlite::params![today, past_date_str, end_date_str],
        |row| {
            Ok(ExpiringSubscription {
                client_id: row.get(0)?,
                client_name: row.get(1)?,
                subscription_type: row.get(2)?,
                end_date: row.get(3)?,
                days_left: row.get(4)?,
            })
        },
    ).map_err(|e| format!("Ошибка чтения: {}", e))?;

    Ok(expiring.filter_map(|e| e.ok()).collect())
}