// src-tauri/src/utils/mod.rs
//
// Вспомогательные функции: работа с датами, путями, валидация.
// Используются в командах и других модулях.

use std::path::PathBuf;

/// Возвращает текущую дату и время в формате ISO 8601.
/// Пример: "2025-03-15T14:30:00"
/// Используется при создании/обновлении записей в БД.
pub fn now_iso() -> String {
    chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Возвращает текущую дату в формате YYYY-MM-DD.
/// Пример: "2025-03-15"
/// Используется для записи даты посещения, оплаты.
pub fn today_iso() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

/// Возвращает текущее время в формате HH:MM.
/// Пример: "14:30"
/// Используется для записи времени прихода/ухода.
pub fn now_time() -> String {
    chrono::Local::now().format("%H:%M").to_string()
}

/// Возвращает первый день текущего месяца в формате YYYY-MM-DD.
/// Пример: "2025-03-01"
/// Используется для расчёта дохода за текущий месяц.
pub fn first_day_of_month() -> String {
    chrono::Local::now().format("%Y-%m-01").to_string()
}

/// Возвращает путь к папке данных приложения.
/// На Windows: C:\Users\<user>\AppData\Roaming\com.champion.gym\
/// На Linux: ~/.local/share/com.champion.gym/
/// В этой папке хранятся: БД, фото клиентов, бэкапы.
pub fn app_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.champion.gym")
}

/// Возвращает путь к папке с фотографиями клиентов.
/// Создаёт папку если она не существует.
pub fn photos_dir() -> PathBuf {
    let dir = app_data_dir().join("photos");
    // Создаём папку при первом обращении
    std::fs::create_dir_all(&dir).ok();
    dir
}

/// Нормализует телефонный номер — убирает лишние символы.
/// Оставляет только цифры и ведущий "+".
/// Примеры:
///   "+375 (29) 123-45-67" → "+375291234567"
///   "80291234567"          → "80291234567"
///   ""                     → None
pub fn normalize_phone(phone: &str) -> Option<String> {
    // Убираем все символы кроме цифр и "+"
    let cleaned: String = phone
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '+')
        .collect();

    // Если после очистки ничего не осталось — возвращаем None
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

/// Валидация: проверяет что строка не пустая и не состоит только из пробелов.
/// Используется для проверки обязательных полей (имя, фамилия).
pub fn is_not_blank(s: &str) -> bool {
    !s.trim().is_empty()
}

/// Обрезает пробелы в начале и конце строки.
/// Для Option<String> — если строка пустая после обрезки, возвращает None.
pub fn trim_optional(s: &Option<String>) -> Option<String> {
    match s {
        Some(val) => {
            let trimmed = val.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        }
        None => None,
    }
}