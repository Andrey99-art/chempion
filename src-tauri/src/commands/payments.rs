// src-tauri/src/commands/payments.rs
//
// Tauri-команды для работы с оплатами:
// - get_client_payments: оплаты конкретного клиента
// - get_payments: все оплаты с фильтрами (общая страница)
// - create_payment: создать оплату
// - get_payments_total: итоговая сумма за период

use tauri::State;
use crate::db::Database;
use crate::models::*;
use crate::utils;

/// Получить оплаты конкретного клиента (для карточки клиента)
#[tauri::command]
pub fn get_client_payments(
    state: State<'_, Database>,
    client_id: i64,
) -> Result<Vec<Payment>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let mut stmt = conn.prepare(
        "SELECT p.id, p.client_id,
                c.last_name || ' ' || c.first_name as client_name,
                p.subscription_id, p.amount, p.payment_date,
                p.description, p.received_by,
                u.full_name as received_by_name,
                p.created_at
         FROM payments p
         JOIN clients c ON p.client_id = c.id
         LEFT JOIN users u ON p.received_by = u.id
         WHERE p.client_id = ?1
         ORDER BY p.payment_date DESC, p.id DESC"
    ).map_err(|e| format!("Ошибка запроса: {}", e))?;

    let payments = stmt.query_map(rusqlite::params![client_id], |row| {
        Ok(Payment {
            id: row.get(0)?,
            client_id: row.get(1)?,
            client_name: row.get(2)?,
            subscription_id: row.get(3)?,
            amount: row.get(4)?,
            payment_date: row.get(5)?,
            description: row.get(6)?,
            received_by: row.get(7)?,
            received_by_name: row.get(8)?,
            created_at: row.get(9)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    Ok(payments.filter_map(|p| p.ok()).collect())
}

/// Получить все оплаты с фильтрами (для общей страницы оплат)
#[tauri::command]
pub fn get_payments(
    state: State<'_, Database>,
    filters: PaymentFilters,
) -> Result<Vec<Payment>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Собираем WHERE условия динамически
    let mut where_clauses: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    // Фильтр по дате начала периода
    if let Some(ref date_from) = filters.date_from {
        where_clauses.push(format!("p.payment_date >= ?{}", params.len() + 1));
        params.push(Box::new(date_from.clone()));
    }

    // Фильтр по дате конца периода
    if let Some(ref date_to) = filters.date_to {
        where_clauses.push(format!("p.payment_date <= ?{}", params.len() + 1));
        params.push(Box::new(date_to.clone()));
    }

    // Фильтр по клиенту
    if let Some(client_id) = filters.client_id {
        where_clauses.push(format!("p.client_id = ?{}", params.len() + 1));
        params.push(Box::new(client_id));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Пагинация
    let page = filters.page.unwrap_or(1).max(1);
    let per_page = filters.per_page.unwrap_or(50).max(1);
    let offset = (page - 1) * per_page;

    let sql = format!(
        "SELECT p.id, p.client_id,
                c.last_name || ' ' || c.first_name as client_name,
                p.subscription_id, p.amount, p.payment_date,
                p.description, p.received_by,
                u.full_name as received_by_name,
                p.created_at
         FROM payments p
         JOIN clients c ON p.client_id = c.id
         LEFT JOIN users u ON p.received_by = u.id
         {}
         ORDER BY p.payment_date DESC, p.id DESC
         LIMIT ?{} OFFSET ?{}",
        where_sql,
        params.len() + 1,
        params.len() + 2,
    );

    params.push(Box::new(per_page));
    params.push(Box::new(offset));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter()
        .map(|p| p.as_ref())
        .collect();

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| format!("Ошибка запроса: {}", e))?;

    let payments = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(Payment {
            id: row.get(0)?,
            client_id: row.get(1)?,
            client_name: row.get(2)?,
            subscription_id: row.get(3)?,
            amount: row.get(4)?,
            payment_date: row.get(5)?,
            description: row.get(6)?,
            received_by: row.get(7)?,
            received_by_name: row.get(8)?,
            created_at: row.get(9)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    Ok(payments.filter_map(|p| p.ok()).collect())
}

/// Создать оплату
#[tauri::command]
pub fn create_payment(
    state: State<'_, Database>,
    request: CreatePaymentRequest,
    received_by: i64,
) -> Result<Payment, String> {
    if request.amount <= 0.0 {
        return Err("Сумма должна быть больше 0".to_string());
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Проверяем что клиент существует
    let client_name: String = conn.query_row(
        "SELECT last_name || ' ' || first_name FROM clients WHERE id = ?1",
        rusqlite::params![request.client_id],
        |row| row.get(0),
    ).map_err(|_| "Клиент не найден".to_string())?;

    let now = utils::now_iso();

    conn.execute(
        "INSERT INTO payments (client_id, subscription_id, amount, payment_date, description, received_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            request.client_id,
            request.subscription_id,
            request.amount,
            request.payment_date,
            request.description,
            received_by,
            now,
        ],
    ).map_err(|e| format!("Ошибка создания оплаты: {}", e))?;

    let id = conn.last_insert_rowid();

    // Получаем имя принявшего оплату
    let received_by_name: Option<String> = conn.query_row(
        "SELECT full_name FROM users WHERE id = ?1",
        rusqlite::params![received_by],
        |row| row.get(0),
    ).ok();

    Ok(Payment {
        id,
        client_id: request.client_id,
        client_name,
        subscription_id: request.subscription_id,
        amount: request.amount,
        payment_date: request.payment_date,
        description: request.description,
        received_by: Some(received_by),
        received_by_name,
        created_at: now,
    })
}

/// Получить итоговую сумму оплат за период
#[tauri::command]
pub fn get_payments_total(
    state: State<'_, Database>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<f64, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Собираем WHERE
    let mut where_clauses: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref df) = date_from {
        where_clauses.push(format!("payment_date >= ?{}", params.len() + 1));
        params.push(Box::new(df.clone()));
    }
    if let Some(ref dt) = date_to {
        where_clauses.push(format!("payment_date <= ?{}", params.len() + 1));
        params.push(Box::new(dt.clone()));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let sql = format!("SELECT COALESCE(SUM(amount), 0.0) FROM payments {}", where_sql);

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter()
        .map(|p| p.as_ref())
        .collect();

    let total: f64 = conn.query_row(&sql, param_refs.as_slice(), |row| row.get(0))
        .map_err(|e| format!("Ошибка подсчёта: {}", e))?;

    Ok(total)
}