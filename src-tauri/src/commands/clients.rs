// src-tauri/src/commands/clients.rs
//
// Tauri-команды для работы с клиентами:
// - get_clients: список с фильтрами, пагинацией, поиском FTS5
// - get_client: один клиент по id (полная информация)
// - create_client: добавление нового клиента
// - update_client: редактирование клиента
// - toggle_client_active: деактивация/активация клиента
// - search_clients_quick: быстрый поиск для автокомплита (посещения)

use tauri::State;
use crate::db::Database;
use crate::models::*;
use crate::utils;

/// Получить список клиентов с фильтрами и пагинацией.
/// Поддерживает: поиск по ФИО/телефону (FTS5), фильтр по тренеру,
/// фильтр по статусу абонемента, пагинацию.
#[tauri::command]
pub fn get_clients(
    state: State<'_, Database>,
    filters: ClientFilters,
) -> Result<ClientListResponse, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let page = filters.page.unwrap_or(1).max(1);          // минимум страница 1
    let per_page = filters.per_page.unwrap_or(50).max(1);  // минимум 1 запись
    let offset = (page - 1) * per_page;

    // Определяем показывать ли деактивированных (по умолчанию — только активных)
    let show_active = filters.is_active.unwrap_or(true);

    // --- Собираем SQL-запрос динамически ---
    // Базовый запрос с LEFT JOIN для подтягивания имени тренера,
    // последнего абонемента и последнего посещения
    let mut where_clauses: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    // Фильтр по активности
    where_clauses.push("c.is_active = ?".to_string());
    params.push(Box::new(show_active));

    // Поиск через FTS5 (если есть поисковый запрос)
    let mut use_fts = false;
    let mut fts_ids: Vec<i64> = Vec::new();

    if let Some(ref search) = filters.search {
        let search_trimmed = search.trim();
        if !search_trimmed.is_empty() {
            // FTS5 запрос: добавляем * для поиска по префиксу
            // "Иван" → "Иван*" — найдёт "Иванов", "Иванова" и т.д.
            let fts_query = format!("{}*", search_trimmed);

            let mut fts_stmt = conn.prepare(
                "SELECT rowid FROM clients_fts WHERE clients_fts MATCH ?1"
            ).map_err(|e| format!("Ошибка поиска: {}", e))?;

            let rows = fts_stmt.query_map(
                rusqlite::params![fts_query],
                |row| row.get::<_, i64>(0),
            ).map_err(|e| format!("Ошибка поиска: {}", e))?;

            fts_ids = rows.filter_map(|r| r.ok()).collect();
            use_fts = true;

            // Если ничего не нашли — возвращаем пустой результат
            if fts_ids.is_empty() {
                return Ok(ClientListResponse {
                    clients: vec![],
                    total: 0,
                    page,
                    per_page,
                });
            }
        }
    }

    // Фильтр по тренеру
    if let Some(trainer_id) = filters.trainer_id {
        where_clauses.push("c.trainer_id = ?".to_string());
        params.push(Box::new(trainer_id));
    }

    // Формируем WHERE часть запроса
    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Добавляем фильтр по FTS id (если был поиск)
    let fts_filter = if use_fts {
        // Создаём список id через запятую: "1,5,12,34"
        let ids_str: String = fts_ids.iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(",");
        format!(" AND c.id IN ({})", ids_str)
    } else {
        String::new()
    };

    // --- Запрос на подсчёт общего количества ---
    let count_sql = format!(
        "SELECT COUNT(*) FROM clients c {} {}",
        where_sql, fts_filter
    );

    // Собираем параметры для rusqlite
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter()
        .map(|p| p.as_ref())
        .collect();

    let total: i64 = conn.query_row(&count_sql, param_refs.as_slice(), |row| row.get(0))
        .map_err(|e| format!("Ошибка подсчёта: {}", e))?;

    // --- Основной запрос с данными ---
    let query_sql = format!(
        "SELECT
            c.id,
            c.last_name,
            c.first_name,
            c.middle_name,
            c.phone,
            u.full_name as trainer_name,
            s.status as subscription_status,
            s.end_date as subscription_end_date,
            (SELECT MAX(v.visit_date) FROM visits v WHERE v.client_id = c.id) as last_visit_date,
            c.is_active
        FROM clients c
        LEFT JOIN users u ON c.trainer_id = u.id
        LEFT JOIN subscriptions s ON s.id = (
            SELECT s2.id FROM subscriptions s2
            WHERE s2.client_id = c.id
            ORDER BY s2.end_date DESC LIMIT 1
        )
        {} {}
        ORDER BY c.last_name ASC, c.first_name ASC
        LIMIT ? OFFSET ?",
        where_sql, fts_filter
    );

    // Добавляем LIMIT и OFFSET к параметрам
    let mut full_params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    for p in params.iter() {
        // Переиспользуем значения — нужно клонировать
        // Так как мы используем bool и i64, создаём заново
        full_params.push(Box::new(show_active));
        break; // первый параметр — is_active
    }
    // Пересобираем параметры заново для основного запроса
    let mut main_params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    main_params.push(Box::new(show_active));

    if let Some(trainer_id) = filters.trainer_id {
        main_params.push(Box::new(trainer_id));
    }

    main_params.push(Box::new(per_page));
    main_params.push(Box::new(offset));

    let main_param_refs: Vec<&dyn rusqlite::types::ToSql> = main_params.iter()
        .map(|p| p.as_ref())
        .collect();

    let mut stmt = conn.prepare(&query_sql)
        .map_err(|e| format!("Ошибка запроса: {}", e))?;

    let clients = stmt.query_map(main_param_refs.as_slice(), |row| {
        Ok(ClientListItem {
            id: row.get(0)?,
            last_name: row.get(1)?,
            first_name: row.get(2)?,
            middle_name: row.get(3)?,
            phone: row.get(4)?,
            trainer_name: row.get(5)?,
            subscription_status: row.get(6)?,
            subscription_end_date: row.get(7)?,
            last_visit_date: row.get(8)?,
            is_active: row.get(9)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    let client_list: Vec<ClientListItem> = clients.filter_map(|c| c.ok()).collect();

    // Фильтр по статусу абонемента (на уровне Rust, после выборки)
    let filtered = if let Some(ref status) = filters.subscription_status {
        client_list.into_iter().filter(|c| {
            match status.as_str() {
                "active" => c.subscription_status.as_deref() == Some("active"),
                "expired" => c.subscription_status.as_deref() == Some("expired"),
                "none" => c.subscription_status.is_none(),
                _ => true,
            }
        }).collect()
    } else {
        client_list
    };

    Ok(ClientListResponse {
        clients: filtered,
        total,
        page,
        per_page,
    })
}

/// Получить полную информацию об одном клиенте по id.
#[tauri::command]
pub fn get_client(
    state: State<'_, Database>,
    client_id: i64,
) -> Result<Client, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    conn.query_row(
        "SELECT
            c.id, c.last_name, c.first_name, c.middle_name,
            c.phone, c.birth_date, c.photo_path, c.trainer_id,
            u.full_name as trainer_name,
            c.medical_notes, c.notes, c.is_active,
            c.created_at, c.updated_at
        FROM clients c
        LEFT JOIN users u ON c.trainer_id = u.id
        WHERE c.id = ?1",
        rusqlite::params![client_id],
        |row| {
            Ok(Client {
                id: row.get(0)?,
                last_name: row.get(1)?,
                first_name: row.get(2)?,
                middle_name: row.get(3)?,
                phone: row.get(4)?,
                birth_date: row.get(5)?,
                photo_path: row.get(6)?,
                trainer_id: row.get(7)?,
                trainer_name: row.get(8)?,
                medical_notes: row.get(9)?,
                notes: row.get(10)?,
                is_active: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        },
    ).map_err(|_| "Клиент не найден".to_string())
}

/// Создать нового клиента.
#[tauri::command]
pub fn create_client(
    state: State<'_, Database>,
    data: ClientFormData,
) -> Result<Client, String> {
    // Валидация обязательных полей
    if !utils::is_not_blank(&data.last_name) {
        return Err("Фамилия не может быть пустой".to_string());
    }
    if !utils::is_not_blank(&data.first_name) {
        return Err("Имя не может быть пустым".to_string());
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let now = utils::now_iso();

    // Нормализуем телефон (убираем лишние символы)
    let phone = data.phone.as_deref().and_then(|p| utils::normalize_phone(p));

    // Обрезаем пробелы в опциональных полях
    let middle_name = utils::trim_optional(&data.middle_name);
    let medical_notes = utils::trim_optional(&data.medical_notes);
    let notes = utils::trim_optional(&data.notes);

    conn.execute(
        "INSERT INTO clients (last_name, first_name, middle_name, phone, birth_date,
            trainer_id, medical_notes, notes, is_active, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?9)",
        rusqlite::params![
            data.last_name.trim(),
            data.first_name.trim(),
            middle_name,
            phone,
            data.birth_date,
            data.trainer_id,
            medical_notes,
            notes,
            now,
        ],
    ).map_err(|e| format!("Ошибка создания клиента: {}", e))?;

    let id = conn.last_insert_rowid();

    // Возвращаем созданного клиента (подтягиваем имя тренера)
    get_client_by_id(&conn, id)
}

/// Обновить данные клиента.
#[tauri::command]
pub fn update_client(
    state: State<'_, Database>,
    client_id: i64,
    data: ClientFormData,
) -> Result<Client, String> {
    if !utils::is_not_blank(&data.last_name) {
        return Err("Фамилия не может быть пустой".to_string());
    }
    if !utils::is_not_blank(&data.first_name) {
        return Err("Имя не может быть пустым".to_string());
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let now = utils::now_iso();
    let phone = data.phone.as_deref().and_then(|p| utils::normalize_phone(p));
    let middle_name = utils::trim_optional(&data.middle_name);
    let medical_notes = utils::trim_optional(&data.medical_notes);
    let notes = utils::trim_optional(&data.notes);

    let rows = conn.execute(
        "UPDATE clients SET
            last_name = ?1, first_name = ?2, middle_name = ?3,
            phone = ?4, birth_date = ?5, trainer_id = ?6,
            medical_notes = ?7, notes = ?8, updated_at = ?9
         WHERE id = ?10",
        rusqlite::params![
            data.last_name.trim(),
            data.first_name.trim(),
            middle_name,
            phone,
            data.birth_date,
            data.trainer_id,
            medical_notes,
            notes,
            now,
            client_id,
        ],
    ).map_err(|e| format!("Ошибка обновления: {}", e))?;

    if rows == 0 {
        return Err("Клиент не найден".to_string());
    }

    get_client_by_id(&conn, client_id)
}

/// Деактивировать/активировать клиента (мягкое удаление).
#[tauri::command]
pub fn toggle_client_active(
    state: State<'_, Database>,
    client_id: i64,
) -> Result<String, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    conn.execute(
        "UPDATE clients SET is_active = NOT is_active, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![utils::now_iso(), client_id],
    ).map_err(|e| format!("Ошибка обновления: {}", e))?;

    Ok("Статус клиента изменён".to_string())
}

/// Быстрый поиск клиентов для автокомплита (регистрация посещений).
/// Возвращает максимум 10 результатов — только id, ФИО, телефон.
#[tauri::command]
pub fn search_clients_quick(
    state: State<'_, Database>,
    query: String,
) -> Result<Vec<ClientListItem>, String> {
    let query_trimmed = query.trim();
    if query_trimmed.is_empty() {
        return Ok(vec![]);
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    // FTS5 поиск с префиксом
    let fts_query = format!("{}*", query_trimmed);

    let mut stmt = conn.prepare(
        "SELECT
            c.id, c.last_name, c.first_name, c.middle_name,
            c.phone, u.full_name as trainer_name,
            s.status as subscription_status,
            s.end_date as subscription_end_date,
            (SELECT MAX(v.visit_date) FROM visits v WHERE v.client_id = c.id) as last_visit_date,
            c.is_active
        FROM clients c
        LEFT JOIN users u ON c.trainer_id = u.id
        LEFT JOIN subscriptions s ON s.id = (
            SELECT s2.id FROM subscriptions s2
            WHERE s2.client_id = c.id
            ORDER BY s2.end_date DESC LIMIT 1
        )
        WHERE c.is_active = 1 AND c.id IN (
            SELECT rowid FROM clients_fts WHERE clients_fts MATCH ?1
        )
        ORDER BY c.last_name ASC, c.first_name ASC
        LIMIT 10"
    ).map_err(|e| format!("Ошибка поиска: {}", e))?;

    let clients = stmt.query_map(rusqlite::params![fts_query], |row| {
        Ok(ClientListItem {
            id: row.get(0)?,
            last_name: row.get(1)?,
            first_name: row.get(2)?,
            middle_name: row.get(3)?,
            phone: row.get(4)?,
            trainer_name: row.get(5)?,
            subscription_status: row.get(6)?,
            subscription_end_date: row.get(7)?,
            last_visit_date: row.get(8)?,
            is_active: row.get(9)?,
        })
    }).map_err(|e| format!("Ошибка чтения: {}", e))?;

    Ok(clients.filter_map(|c| c.ok()).collect())
}

/// Получить список тренеров (для выпадающего списка в форме клиента).
#[tauri::command]
pub fn get_trainers(
    state: State<'_, Database>,
) -> Result<Vec<User>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, username, full_name, role, is_active, force_password_change, created_at
         FROM users WHERE is_active = 1
         ORDER BY full_name ASC"
    ).map_err(|e| format!("Ошибка запроса: {}", e))?;

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

    Ok(users.filter_map(|u| u.ok()).collect())
}

// === Вспомогательная функция (не экспортируется как команда) ===

/// Получить клиента по id из соединения (используется внутри create/update).
fn get_client_by_id(conn: &rusqlite::Connection, id: i64) -> Result<Client, String> {
    conn.query_row(
        "SELECT
            c.id, c.last_name, c.first_name, c.middle_name,
            c.phone, c.birth_date, c.photo_path, c.trainer_id,
            u.full_name as trainer_name,
            c.medical_notes, c.notes, c.is_active,
            c.created_at, c.updated_at
        FROM clients c
        LEFT JOIN users u ON c.trainer_id = u.id
        WHERE c.id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Client {
                id: row.get(0)?,
                last_name: row.get(1)?,
                first_name: row.get(2)?,
                middle_name: row.get(3)?,
                phone: row.get(4)?,
                birth_date: row.get(5)?,
                photo_path: row.get(6)?,
                trainer_id: row.get(7)?,
                trainer_name: row.get(8)?,
                medical_notes: row.get(9)?,
                notes: row.get(10)?,
                is_active: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        },
    ).map_err(|_| "Клиент не найден".to_string())
}