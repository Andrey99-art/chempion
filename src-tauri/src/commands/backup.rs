// src-tauri/src/commands/backup.rs
//
// Tauri-команды для бэкапа и восстановления БД:
// - create_backup: копирование файла БД в выбранную папку
// - restore_backup: замена текущей БД файлом из бэкапа
// - get_db_path: получить путь к текущей БД (для информации)
// - get_db_size: размер файла БД

use crate::utils;
use std::fs;
use std::path::PathBuf;

/// Получить путь к файлу базы данных
fn db_path() -> PathBuf {
    utils::app_data_dir().join("gym_champion.db")
}

/// Получить путь к текущей БД (для отображения в настройках)
#[tauri::command]
pub fn get_db_info() -> Result<DbInfo, String> {
    let path = db_path();

    let size_bytes = fs::metadata(&path)
        .map(|m| m.len())
        .unwrap_or(0);

    // Форматируем размер в КБ или МБ
    let size_display = if size_bytes < 1024 * 1024 {
        format!("{:.1} КБ", size_bytes as f64 / 1024.0)
    } else {
        format!("{:.1} МБ", size_bytes as f64 / (1024.0 * 1024.0))
    };

    Ok(DbInfo {
        path: path.to_string_lossy().to_string(),
        size_display,
    })
}

/// Создать бэкап — копирование файла БД в указанную папку.
/// Имя файла: gym_champion_backup_YYYY-MM-DD_HH-MM.db
#[tauri::command]
pub fn create_backup(
    output_dir: String,
) -> Result<String, String> {
    let source = db_path();

    // Проверяем что исходный файл существует
    if !source.exists() {
        return Err("Файл базы данных не найден".to_string());
    }

    // Формируем имя файла бэкапа с датой и временем
    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M").to_string();
    let backup_name = format!("gym_champion_backup_{}.db", timestamp);

    let dest = PathBuf::from(&output_dir).join(&backup_name);

    // Проверяем что папка назначения существует
    let dest_dir = PathBuf::from(&output_dir);
    if !dest_dir.exists() {
        return Err("Указанная папка не существует".to_string());
    }

    // Копируем файл
    fs::copy(&source, &dest)
        .map_err(|e| format!("Ошибка копирования: {}", e))?;

    // Также копируем WAL-файл если он есть (для полной целостности)
    let wal_source = source.with_extension("db-wal");
    if wal_source.exists() {
        let wal_dest = dest.with_extension("db-wal");
        fs::copy(&wal_source, &wal_dest).ok(); // не критично если не получится
    }

    // Копируем SHM-файл если есть
    let shm_source = source.with_extension("db-shm");
    if shm_source.exists() {
        let shm_dest = dest.with_extension("db-shm");
        fs::copy(&shm_source, &shm_dest).ok();
    }

    Ok(format!("Бэкап создан: {}", dest.to_string_lossy()))
}

/// Восстановить БД из бэкапа.
/// ВНИМАНИЕ: заменяет текущую базу данных!
/// Приложение нужно перезапустить после восстановления.
#[tauri::command]
pub fn restore_backup(
    backup_path: String,
) -> Result<String, String> {
    let source = PathBuf::from(&backup_path);
    let dest = db_path();

    // Проверяем что файл бэкапа существует
    if !source.exists() {
        return Err("Файл бэкапа не найден".to_string());
    }

    // Проверяем что это файл .db (базовая проверка)
    let extension = source.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    if extension != "db" {
        return Err("Файл должен иметь расширение .db".to_string());
    }

    // Проверяем размер файла (должен быть > 0)
    let size = fs::metadata(&source)
        .map(|m| m.len())
        .unwrap_or(0);
    if size == 0 {
        return Err("Файл бэкапа пуст".to_string());
    }

    // Создаём резервную копию текущей БД перед заменой (на всякий случай)
    let safety_backup = dest.with_extension("db.before_restore");
    if dest.exists() {
        fs::copy(&dest, &safety_backup)
            .map_err(|e| format!("Ошибка создания резервной копии: {}", e))?;
    }

    // Удаляем WAL и SHM файлы текущей БД (они станут невалидны)
    let wal = dest.with_extension("db-wal");
    let shm = dest.with_extension("db-shm");
    fs::remove_file(&wal).ok();
    fs::remove_file(&shm).ok();

    // Копируем бэкап на место текущей БД
    fs::copy(&source, &dest)
        .map_err(|e| {
            // Если не получилось — пытаемся восстановить из safety backup
            if safety_backup.exists() {
                fs::copy(&safety_backup, &dest).ok();
            }
            format!("Ошибка восстановления: {}. Текущая БД не повреждена.", e)
        })?;

    // Копируем WAL файл бэкапа если есть
    let backup_wal = source.with_extension("db-wal");
    if backup_wal.exists() {
        fs::copy(&backup_wal, &wal).ok();
    }

    // Удаляем safety backup
    fs::remove_file(&safety_backup).ok();

    Ok("База данных восстановлена. Перезапустите приложение.".to_string())
}

/// Информация о базе данных
#[derive(Debug, serde::Serialize)]
pub struct DbInfo {
    pub path: String,
    pub size_display: String,
}