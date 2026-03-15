// src-tauri/src/commands/import.rs
//
// Tauri-команды для импорта данных из Excel (.xlsx):
// - preview_import: прочитать файл и показать предпросмотр
// - execute_import: выполнить импорт после подтверждения
//
// Поддерживает: ФИО (в одном или отдельных столбцах), телефон, дата рождения.
// Умный парсинг: форматы дат (DD.MM.YYYY, YYYY-MM-DD), телефонов (+375..., 80...).
// Валидация: пустые поля, дубликаты по ФИО+телефон.

use tauri::State;
use crate::db::Database;
use crate::models::*;
use crate::utils;

use calamine::{open_workbook, Reader, Xlsx, Data};

/// Предпросмотр данных из Excel-файла.
/// Читает файл, парсит строки, валидирует — возвращает список строк с ошибками.
#[tauri::command]
pub fn preview_import(
    state: State<'_, Database>,
    file_path: String,
    column_mapping: ColumnMapping,
) -> Result<Vec<ImportPreviewRow>, String> {
    // Открываем Excel-файл
    let mut workbook: Xlsx<_> = open_workbook(&file_path)
        .map_err(|e| format!("Не удалось открыть файл: {}", e))?;

    // Берём первый лист
    let sheet_name = workbook.sheet_names().first()
        .ok_or("Файл не содержит листов".to_string())?
        .clone();

    let range = workbook.worksheet_range(&sheet_name)
        .map_err(|e| format!("Ошибка чтения листа: {}", e))?;

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let mut preview: Vec<ImportPreviewRow> = Vec::new();

    // Пропускаем первую строку (заголовки) — start_row настраивается
    let start_row = column_mapping.start_row.unwrap_or(1) as usize;

    for (row_idx, row) in range.rows().enumerate() {
        // Пропускаем заголовки
        if row_idx < start_row {
            continue;
        }

        let mut errors: Vec<String> = Vec::new();

        // --- Парсинг ФИО ---
        let (last_name, first_name, middle_name) = if let Some(fio_col) = column_mapping.fio_column {
            // ФИО в одном столбце — разбиваем по пробелам
            let fio_raw = get_cell_string(row, fio_col as usize);
            parse_fio(&fio_raw)
        } else {
            // ФИО в отдельных столбцах
            let ln = get_cell_string(row, column_mapping.last_name_column.unwrap_or(0) as usize);
            let fn_ = get_cell_string(row, column_mapping.first_name_column.unwrap_or(1) as usize);
            let mn = if let Some(col) = column_mapping.middle_name_column {
                let val = get_cell_string(row, col as usize);
                if val.is_empty() { None } else { Some(val) }
            } else {
                None
            };
            (ln, fn_, mn)
        };

        // Валидация ФИО
        if last_name.is_empty() {
            errors.push("Пустая фамилия".to_string());
        }
        if first_name.is_empty() {
            errors.push("Пустое имя".to_string());
        }

        // --- Парсинг телефона ---
        let phone = if let Some(col) = column_mapping.phone_column {
            let raw = get_cell_string(row, col as usize);
            parse_phone(&raw)
        } else {
            None
        };

        // --- Парсинг даты рождения ---
        let birth_date = if let Some(col) = column_mapping.birth_date_column {
            let raw = get_cell_string(row, col as usize);
            parse_date(&raw)
        } else {
            None
        };

        // --- Проверка дубликатов ---
        if !last_name.is_empty() && !first_name.is_empty() {
            let duplicate = check_duplicate(&conn, &last_name, &first_name, &phone);
            if duplicate {
                errors.push("Дубликат (уже есть в базе)".to_string());
            }
        }

        // Пропускаем полностью пустые строки
        if last_name.is_empty() && first_name.is_empty() && phone.is_none() {
            continue;
        }

        let is_valid = errors.is_empty();

        preview.push(ImportPreviewRow {
            row_number: row_idx + 1, // номер строки (1-based, как в Excel)
            last_name,
            first_name,
            middle_name,
            phone,
            birth_date,
            is_valid,
            errors,
        });
    }

    Ok(preview)
}

/// Выполнить импорт подтверждённых строк.
/// Принимает список строк (уже провалидированных) — вставляет в БД.
#[tauri::command]
pub fn execute_import(
    state: State<'_, Database>,
    rows: Vec<ImportPreviewRow>,
) -> Result<ImportResult, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let now = utils::now_iso();
    let mut imported: usize = 0;
    let mut skipped: usize = 0;
    let mut errors: Vec<String> = Vec::new();

    for row in &rows {
        // Пропускаем невалидные строки
        if !row.is_valid {
            skipped += 1;
            if !row.errors.is_empty() {
                errors.push(format!(
                    "Строка {}: {}",
                    row.row_number,
                    row.errors.join(", ")
                ));
            }
            continue;
        }

        // Нормализуем телефон
        let phone = row.phone.as_deref().and_then(|p| utils::normalize_phone(p));

        // Вставляем клиента
        let result = conn.execute(
            "INSERT INTO clients (last_name, first_name, middle_name, phone, birth_date,
                is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)",
            rusqlite::params![
                row.last_name,
                row.first_name,
                row.middle_name,
                phone,
                row.birth_date,
                now,
            ],
        );

        match result {
            Ok(_) => imported += 1,
            Err(e) => {
                skipped += 1;
                errors.push(format!("Строка {}: {}", row.row_number, e));
            }
        }
    }

    Ok(ImportResult {
        imported,
        skipped,
        errors,
    })
}

/// Получить названия столбцов из первой строки Excel-файла.
/// Нужно для маппинга колонок на фронтенде.
#[tauri::command]
pub fn get_excel_columns(
    file_path: String,
) -> Result<Vec<String>, String> {
    let mut workbook: Xlsx<_> = open_workbook(&file_path)
        .map_err(|e| format!("Не удалось открыть файл: {}", e))?;

    let sheet_name = workbook.sheet_names().first()
        .ok_or("Файл не содержит листов".to_string())?
        .clone();

    let range = workbook.worksheet_range(&sheet_name)
        .map_err(|e| format!("Ошибка чтения листа: {}", e))?;

    // Берём первую строку как заголовки
    let headers: Vec<String> = range.rows()
        .next()
        .map(|row| {
            row.iter().map(|cell| cell_to_string(cell)).collect()
        })
        .unwrap_or_default();

    Ok(headers)
}

// ============================================================
// Вспомогательные структуры и функции
// ============================================================

/// Маппинг столбцов Excel → поля клиента.
/// Фронтенд присылает номера столбцов (0-based).
#[derive(Debug, serde::Deserialize)]
pub struct ColumnMapping {
    /// Столбец с ФИО целиком (если ФИО в одном столбце)
    pub fio_column: Option<i32>,
    /// Столбец с фамилией (если ФИО в разных столбцах)
    pub last_name_column: Option<i32>,
    /// Столбец с именем
    pub first_name_column: Option<i32>,
    /// Столбец с отчеством
    pub middle_name_column: Option<i32>,
    /// Столбец с телефоном
    pub phone_column: Option<i32>,
    /// Столбец с датой рождения
    pub birth_date_column: Option<i32>,
    /// С какой строки начинать (0 = первая строка, 1 = пропустить заголовок)
    pub start_row: Option<i32>,
}

/// Получить строковое значение ячейки по индексу
fn get_cell_string(row: &[Data], col: usize) -> String {
    row.get(col)
        .map(|cell| cell_to_string(cell))
        .unwrap_or_default()
}

/// Преобразовать значение ячейки в строку
fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::String(s) => s.trim().to_string(),
        Data::Float(f) => {
            // Если число целое — убираем ".0"
            if *f == (*f as i64) as f64 {
                format!("{}", *f as i64)
            } else {
                format!("{}", f)
            }
        }
        Data::Int(i) => format!("{}", i),
        Data::Bool(b) => format!("{}", b),
        Data::DateTime(dt) => {
            // ExcelDateTime — просто выводим через Display, потом парсим в parse_date
            format!("{}", dt)
        }
        Data::DateTimeIso(s) => s.clone(),
        Data::DurationIso(s) => s.clone(),
        Data::Error(_) | Data::Empty => String::new(),
    }
}

/// Разбить ФИО из одного столбца на фамилию, имя, отчество.
/// "Иванов Иван Иванович" → ("Иванов", "Иван", Some("Иванович"))
/// "Иванов Иван" → ("Иванов", "Иван", None)
fn parse_fio(raw: &str) -> (String, String, Option<String>) {
    let parts: Vec<&str> = raw.split_whitespace().collect();
    match parts.len() {
        0 => (String::new(), String::new(), None),
        1 => (parts[0].to_string(), String::new(), None),
        2 => (parts[0].to_string(), parts[1].to_string(), None),
        _ => (
            parts[0].to_string(),
            parts[1].to_string(),
            Some(parts[2..].join(" ")),
        ),
    }
}

/// Парсинг телефона — убирает мусор, нормализует.
fn parse_phone(raw: &str) -> Option<String> {
    let cleaned: String = raw.chars()
        .filter(|c| c.is_ascii_digit() || *c == '+')
        .collect();

    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

/// Парсинг даты — поддерживает DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY.
fn parse_date(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Уже в ISO формате (YYYY-MM-DD)
    if chrono::NaiveDate::parse_from_str(trimmed, "%Y-%m-%d").is_ok() {
        return Some(trimmed.to_string());
    }

    // Формат DD.MM.YYYY
    if let Ok(date) = chrono::NaiveDate::parse_from_str(trimmed, "%d.%m.%Y") {
        return Some(date.format("%Y-%m-%d").to_string());
    }

    // Формат DD/MM/YYYY
    if let Ok(date) = chrono::NaiveDate::parse_from_str(trimmed, "%d/%m/%Y") {
        return Some(date.format("%Y-%m-%d").to_string());
    }

    None
}

/// Проверка дубликата по ФИО + телефон
fn check_duplicate(
    conn: &rusqlite::Connection,
    last_name: &str,
    first_name: &str,
    phone: &Option<String>,
) -> bool {
    // Проверяем по ФИО
    let by_name: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM clients WHERE LOWER(last_name) = LOWER(?1) AND LOWER(first_name) = LOWER(?2)",
        rusqlite::params![last_name, first_name],
        |row| row.get(0),
    ).unwrap_or(false);

    if by_name {
        return true;
    }

    // Проверяем по телефону (если есть)
    if let Some(ref p) = phone {
        let normalized = utils::normalize_phone(p);
        if let Some(ref norm) = normalized {
            let by_phone: bool = conn.query_row(
                "SELECT COUNT(*) > 0 FROM clients WHERE phone = ?1",
                rusqlite::params![norm],
                |row| row.get(0),
            ).unwrap_or(false);
            return by_phone;
        }
    }

    false
}