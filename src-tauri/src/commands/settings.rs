// src-tauri/src/commands/settings.rs
//
// Tauri-команды для настроек приложения:
// - upload_logo: загрузить логотип
// - get_logo_path: получить путь к логотипу
// - get_setting / set_setting: чтение/запись настроек

use tauri::State;
use crate::db::Database;
use crate::utils;
use std::fs;
use std::path::PathBuf;

/// Путь к файлу логотипа
fn logo_path() -> PathBuf {
    utils::app_data_dir().join("logo.png")
}

/// Загрузить логотип — копирует выбранный файл в папку данных приложения.
/// Поддерживает: .png, .jpg, .jpeg, .svg
#[tauri::command]
pub fn upload_logo(
    source_path: String,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);

    if !source.exists() {
        return Err("Файл не найден".to_string());
    }

    // Проверяем расширение
    let ext = source.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !["png", "jpg", "jpeg", "svg"].contains(&ext.as_str()) {
        return Err("Поддерживаются форматы: PNG, JPG, SVG".to_string());
    }

    // Определяем путь назначения (всегда logo.png/logo.jpg/logo.svg)
    let dest = utils::app_data_dir().join(format!("logo.{}", ext));

    // Удаляем старый логотип (может быть другого формата)
    for old_ext in &["png", "jpg", "jpeg", "svg"] {
        let old_path = utils::app_data_dir().join(format!("logo.{}", old_ext));
        fs::remove_file(&old_path).ok();
    }

    // Копируем новый
    fs::copy(&source, &dest)
        .map_err(|e| format!("Ошибка копирования: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

/// Получить логотип как base64 строку (для отображения в WebView).
/// Возвращает data URI: "data:image/png;base64,..."
#[tauri::command]
pub fn get_logo_base64() -> Result<Option<String>, String> {
    for ext in &["png", "jpg", "jpeg", "svg"] {
        let path = utils::app_data_dir().join(format!("logo.{}", ext));
        if path.exists() {
            let data = fs::read(&path)
                .map_err(|e| format!("Ошибка чтения логотипа: {}", e))?;

            let mime = match *ext {
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "svg" => "image/svg+xml",
                _ => "image/png",
            };

            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
            return Ok(Some(format!("data:{};base64,{}", mime, b64)));
        }
    }
    Ok(None)
}

/// Получить значение настройки по ключу
#[tauri::command]
pub fn get_setting(
    state: State<'_, Database>,
    key: String,
) -> Result<Option<String>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get::<_, Option<String>>(0),
    );

    match result {
        Ok(value) => Ok(value),
        Err(_) => Ok(None),
    }
}

/// Установить значение настройки
#[tauri::command]
pub fn set_setting(
    state: State<'_, Database>,
    key: String,
    value: String,
) -> Result<String, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    ).map_err(|e| format!("Ошибка сохранения: {}", e))?;

    Ok("Настройка сохранена".to_string())
}

/// Загрузить фото клиента — копирует файл в папку photos.
/// Возвращает путь к сохранённому файлу.
#[tauri::command]
pub fn upload_client_photo(
    state: State<'_, Database>,
    client_id: i64,
    source_path: String,
) -> Result<String, String> {
    let source = std::path::PathBuf::from(&source_path);

    if !source.exists() {
        return Err("Файл не найден".to_string());
    }

    // Определяем расширение
    let ext = source.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    // Создаём папку photos если нет
    let photos = utils::photos_dir();

    // Имя файла: client_<id>.<ext>
    let filename = format!("client_{}.{}", client_id, ext);
    let dest = photos.join(&filename);

    // Удаляем старое фото если есть (может быть другого формата)
    for old_ext in &["png", "jpg", "jpeg", "gif", "webp", "svg"] {
        let old_path = photos.join(format!("client_{}.{}", client_id, old_ext));
        fs::remove_file(&old_path).ok();
    }

    // Копируем
    fs::copy(&source, &dest)
        .map_err(|e| format!("Ошибка копирования: {}", e))?;

    // Обновляем путь в БД
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    conn.execute(
        "UPDATE clients SET photo_path = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![dest.to_string_lossy().to_string(), utils::now_iso(), client_id],
    ).map_err(|e| format!("Ошибка обновления: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

/// Получить фото клиента как base64
#[tauri::command]
pub fn get_client_photo_base64(
    state: State<'_, Database>,
    client_id: i64,
) -> Result<Option<String>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let photo_path: Option<String> = conn.query_row(
        "SELECT photo_path FROM clients WHERE id = ?1",
        rusqlite::params![client_id],
        |row| row.get(0),
    ).map_err(|_| "Клиент не найден".to_string())?;

    let path = match photo_path {
        Some(p) if !p.is_empty() => std::path::PathBuf::from(p),
        _ => return Ok(None),
    };

    if !path.exists() {
        return Ok(None);
    }

    let data = fs::read(&path)
        .map_err(|e| format!("Ошибка чтения фото: {}", e))?;

    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/jpeg",
    };

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(Some(format!("data:{};base64,{}", mime, b64)))
}