// src-tauri/src/commands/export.rs
//
// Tauri-команды для экспорта данных в Excel (.xlsx):
// - export_clients: экспорт списка клиентов
// - export_payments: экспорт оплат за период
//
// Используем rust_xlsxwriter для создания красиво отформатированных файлов.

use tauri::State;
use crate::db::Database;
use crate::utils;

use rust_xlsxwriter::{Workbook, Format, Color, FormatAlign, FormatBorder};

/// Экспорт списка клиентов в Excel.
/// Возвращает путь к созданному файлу.
#[tauri::command]
pub fn export_clients(
    state: State<'_, Database>,
    output_path: String,
    include_inactive: Option<bool>,
) -> Result<String, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let show_inactive = include_inactive.unwrap_or(false);

    // Запрос клиентов с тренером и последним абонементом
    let where_clause = if show_inactive { "" } else { "WHERE c.is_active = 1" };

    let sql = format!(
        "SELECT c.last_name, c.first_name, c.middle_name, c.phone,
                c.birth_date, u.full_name as trainer_name,
                s.status as sub_status, s.end_date as sub_end_date,
                (SELECT MAX(v.visit_date) FROM visits v WHERE v.client_id = c.id) as last_visit
         FROM clients c
         LEFT JOIN users u ON c.trainer_id = u.id
         LEFT JOIN subscriptions s ON s.id = (
             SELECT s2.id FROM subscriptions s2
             WHERE s2.client_id = c.id
             ORDER BY s2.end_date DESC LIMIT 1
         )
         {}
         ORDER BY c.last_name ASC, c.first_name ASC",
        where_clause
    );

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| format!("Ошибка запроса: {}", e))?;

    // Собираем данные
    let rows: Vec<(String, String, Option<String>, Option<String>, Option<String>,
                   Option<String>, Option<String>, Option<String>, Option<String>)> =
        stmt.query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
            ))
        })
        .map_err(|e| format!("Ошибка чтения: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Создаём Excel файл
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet.set_name("Клиенты")
        .map_err(|e| format!("Ошибка: {}", e))?;

    // --- Форматы ---
    // Заголовок
    let header_format = Format::new()
        .set_bold()
        .set_font_size(11.0)
        .set_background_color(Color::RGB(0x1E293B)) // slate-800
        .set_font_color(Color::White)
        .set_align(FormatAlign::Center)
        .set_border(FormatBorder::Thin);

    // Обычная ячейка
    let cell_format = Format::new()
        .set_font_size(10.0)
        .set_border(FormatBorder::Thin);

    // Статус "Активен" — зелёный
    let active_format = Format::new()
        .set_font_size(10.0)
        .set_font_color(Color::RGB(0x16A34A))
        .set_border(FormatBorder::Thin);

    // Статус "Истёк" — красный
    let expired_format = Format::new()
        .set_font_size(10.0)
        .set_font_color(Color::RGB(0xDC2626))
        .set_border(FormatBorder::Thin);

    // --- Заголовки ---
    let headers = [
        "Фамилия", "Имя", "Отчество", "Телефон",
        "Дата рождения", "Тренер", "Абонемент", "До", "Последний визит",
    ];

    for (col, header) in headers.iter().enumerate() {
        worksheet.write_string_with_format(0, col as u16, *header, &header_format)
            .map_err(|e| format!("Ошибка записи: {}", e))?;
    }

    // --- Данные ---
    for (row_idx, row_data) in rows.iter().enumerate() {
        let r = (row_idx + 1) as u32;

        worksheet.write_string_with_format(r, 0, &row_data.0, &cell_format).ok();
        worksheet.write_string_with_format(r, 1, &row_data.1, &cell_format).ok();
        worksheet.write_string_with_format(r, 2, row_data.2.as_deref().unwrap_or(""), &cell_format).ok();
        worksheet.write_string_with_format(r, 3, row_data.3.as_deref().unwrap_or(""), &cell_format).ok();
        worksheet.write_string_with_format(r, 4, &format_date_for_excel(row_data.4.as_deref()), &cell_format).ok();
        worksheet.write_string_with_format(r, 5, row_data.5.as_deref().unwrap_or(""), &cell_format).ok();

        // Статус абонемента — с цветом
        let status_text = match row_data.6.as_deref() {
            Some("active") => "Активен",
            Some("expired") => "Истёк",
            Some("frozen") => "Заморожен",
            _ => "Нет",
        };
        let status_fmt = match row_data.6.as_deref() {
            Some("active") => &active_format,
            Some("expired") => &expired_format,
            _ => &cell_format,
        };
        worksheet.write_string_with_format(r, 6, status_text, status_fmt).ok();
        worksheet.write_string_with_format(r, 7, &format_date_for_excel(row_data.7.as_deref()), &cell_format).ok();
        worksheet.write_string_with_format(r, 8, &format_date_for_excel(row_data.8.as_deref()), &cell_format).ok();
    }

    // --- Ширина столбцов ---
    worksheet.set_column_width(0, 18.0).ok();  // Фамилия
    worksheet.set_column_width(1, 15.0).ok();  // Имя
    worksheet.set_column_width(2, 18.0).ok();  // Отчество
    worksheet.set_column_width(3, 20.0).ok();  // Телефон
    worksheet.set_column_width(4, 14.0).ok();  // Дата рождения
    worksheet.set_column_width(5, 20.0).ok();  // Тренер
    worksheet.set_column_width(6, 12.0).ok();  // Абонемент
    worksheet.set_column_width(7, 12.0).ok();  // До
    worksheet.set_column_width(8, 14.0).ok();  // Последний визит

    // Сохраняем
    workbook.save(&output_path)
        .map_err(|e| format!("Ошибка сохранения файла: {}", e))?;

    Ok(format!("Экспортировано {} клиентов", rows.len()))
}

/// Экспорт оплат за период в Excel.
#[tauri::command]
pub fn export_payments(
    state: State<'_, Database>,
    output_path: String,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<String, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // Собираем WHERE
    let mut where_clauses: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref df) = date_from {
        where_clauses.push(format!("p.payment_date >= ?{}", params.len() + 1));
        params.push(Box::new(df.clone()));
    }
    if let Some(ref dt) = date_to {
        where_clauses.push(format!("p.payment_date <= ?{}", params.len() + 1));
        params.push(Box::new(dt.clone()));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let sql = format!(
        "SELECT p.payment_date, c.last_name || ' ' || c.first_name as client_name,
                p.amount, p.description, u.full_name as received_by_name
         FROM payments p
         JOIN clients c ON p.client_id = c.id
         LEFT JOIN users u ON p.received_by = u.id
         {}
         ORDER BY p.payment_date DESC, p.id DESC",
        where_sql
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter()
        .map(|p| p.as_ref())
        .collect();

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| format!("Ошибка запроса: {}", e))?;

    let rows: Vec<(String, String, f64, Option<String>, Option<String>)> =
        stmt.query_map(param_refs.as_slice(), |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .map_err(|e| format!("Ошибка чтения: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Считаем итого
    let total: f64 = rows.iter().map(|r| r.2).sum();

    // Создаём Excel
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet.set_name("Оплаты")
        .map_err(|e| format!("Ошибка: {}", e))?;

    let header_format = Format::new()
        .set_bold()
        .set_font_size(11.0)
        .set_background_color(Color::RGB(0x1E293B))
        .set_font_color(Color::White)
        .set_align(FormatAlign::Center)
        .set_border(FormatBorder::Thin);

    let cell_format = Format::new()
        .set_font_size(10.0)
        .set_border(FormatBorder::Thin);

    let money_format = Format::new()
        .set_font_size(10.0)
        .set_num_format("0.00")
        .set_border(FormatBorder::Thin);

    let total_format = Format::new()
        .set_bold()
        .set_font_size(11.0)
        .set_num_format("0.00")
        .set_border(FormatBorder::Thin);

    // Заголовки
    let headers = ["Дата", "Клиент", "Сумма (BYN)", "Описание", "Принял"];
    for (col, header) in headers.iter().enumerate() {
        worksheet.write_string_with_format(0, col as u16, *header, &header_format).ok();
    }

    // Данные
    for (row_idx, row_data) in rows.iter().enumerate() {
        let r = (row_idx + 1) as u32;
        worksheet.write_string_with_format(r, 0, &format_date_for_excel(Some(&row_data.0)), &cell_format).ok();
        worksheet.write_string_with_format(r, 1, &row_data.1, &cell_format).ok();
        worksheet.write_number_with_format(r, 2, row_data.2, &money_format).ok();
        worksheet.write_string_with_format(r, 3, row_data.3.as_deref().unwrap_or(""), &cell_format).ok();
        worksheet.write_string_with_format(r, 4, row_data.4.as_deref().unwrap_or(""), &cell_format).ok();
    }

    // Итого
    let total_row = (rows.len() + 1) as u32;
    worksheet.write_string_with_format(total_row, 1, "ИТОГО:", &total_format).ok();
    worksheet.write_number_with_format(total_row, 2, total, &total_format).ok();

    // Ширина столбцов
    worksheet.set_column_width(0, 14.0).ok();
    worksheet.set_column_width(1, 25.0).ok();
    worksheet.set_column_width(2, 14.0).ok();
    worksheet.set_column_width(3, 25.0).ok();
    worksheet.set_column_width(4, 20.0).ok();

    workbook.save(&output_path)
        .map_err(|e| format!("Ошибка сохранения: {}", e))?;

    Ok(format!("Экспортировано {} оплат, итого: {:.2} BYN", rows.len(), total))
}

// === Вспомогательные функции ===

/// Форматирует дату для Excel: "2025-03-15" → "15.03.2025"
fn format_date_for_excel(date: Option<&str>) -> String {
    match date {
        Some(d) if !d.is_empty() => {
            if let Ok(parsed) = chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d") {
                parsed.format("%d.%m.%Y").to_string()
            } else {
                d.to_string()
            }
        }
        _ => String::new(),
    }
}