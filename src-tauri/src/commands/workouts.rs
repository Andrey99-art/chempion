// src-tauri/src/commands/workouts.rs
//
// Tauri-команды для работы с тренировками:
// - Справочник упражнений (CRUD)
// - Шаблоны тренировок (CRUD)
// - Тренировки клиентов (создание, просмотр, история)

use tauri::State;
use crate::db::Database;
use crate::utils;

// ============================================================
// Структуры данных (локальные для этого модуля)
// ============================================================

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Exercise {
    pub id: i64,
    pub name: String,
    pub muscle_group: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct WorkoutTemplate {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub trainer_name: Option<String>,
    pub exercises: Vec<TemplateExercise>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct TemplateExercise {
    pub id: i64,
    pub exercise_id: i64,
    pub exercise_name: String,
    pub muscle_group: Option<String>,
    pub order_index: i64,
    pub default_sets: i64,
    pub default_reps: i64,
    pub notes: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Workout {
    pub id: i64,
    pub client_id: i64,
    pub client_name: String,
    pub trainer_name: Option<String>,
    pub template_name: Option<String>,
    pub workout_date: String,
    pub notes: Option<String>,
    pub exercises: Vec<WorkoutExercise>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct WorkoutExercise {
    pub id: i64,
    pub exercise_id: i64,
    pub exercise_name: String,
    pub muscle_group: Option<String>,
    pub order_index: i64,
    pub sets_data: String,  // JSON строка
    pub notes: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateWorkoutRequest {
    pub client_id: i64,
    pub trainer_id: Option<i64>,
    pub template_id: Option<i64>,
    pub workout_date: String,
    pub notes: Option<String>,
    pub exercises: Vec<CreateWorkoutExercise>,
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateWorkoutExercise {
    pub exercise_id: i64,
    pub order_index: i64,
    pub sets_data: String,
    pub notes: Option<String>,
}

// ============================================================
// Справочник упражнений
// ============================================================

/// Получить все упражнения (группированные по мышечным группам)
#[tauri::command]
pub fn get_exercises(
    state: State<'_, Database>,
    include_inactive: Option<bool>,
) -> Result<Vec<Exercise>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let sql = if include_inactive.unwrap_or(false) {
        "SELECT id, name, muscle_group, is_active FROM exercises ORDER BY muscle_group, name"
    } else {
        "SELECT id, name, muscle_group, is_active FROM exercises WHERE is_active = 1 ORDER BY muscle_group, name"
    };

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("Ошибка: {}", e))?;

    let exercises = stmt.query_map([], |row| {
        Ok(Exercise {
            id: row.get(0)?,
            name: row.get(1)?,
            muscle_group: row.get(2)?,
            is_active: row.get(3)?,
        })
    }).map_err(|e| format!("Ошибка: {}", e))?;

    Ok(exercises.filter_map(|e| e.ok()).collect())
}

/// Создать упражнение
#[tauri::command]
pub fn create_exercise(
    state: State<'_, Database>,
    name: String,
    muscle_group: Option<String>,
) -> Result<Exercise, String> {
    if name.trim().is_empty() {
        return Err("Введите название упражнения".to_string());
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let now = utils::now_iso();

    conn.execute(
        "INSERT INTO exercises (name, muscle_group, is_active, created_at) VALUES (?1, ?2, 1, ?3)",
        rusqlite::params![name.trim(), muscle_group, now],
    ).map_err(|e| format!("Ошибка: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(Exercise {
        id,
        name: name.trim().to_string(),
        muscle_group,
        is_active: true,
    })
}

// ============================================================
// Шаблоны тренировок
// ============================================================

/// Получить все шаблоны тренировок
#[tauri::command]
pub fn get_workout_templates(
    state: State<'_, Database>,
) -> Result<Vec<WorkoutTemplate>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let mut stmt = conn.prepare(
        "SELECT wt.id, wt.name, wt.description, u.full_name
         FROM workout_templates wt
         LEFT JOIN users u ON wt.trainer_id = u.id
         WHERE wt.is_active = 1
         ORDER BY wt.name"
    ).map_err(|e| format!("Ошибка: {}", e))?;

    let templates: Vec<(i64, String, Option<String>, Option<String>)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    }).map_err(|e| format!("Ошибка: {}", e))?
      .filter_map(|t| t.ok())
      .collect();

    let mut result = Vec::new();
    for (id, name, description, trainer_name) in templates {
        let exercises = get_template_exercises_internal(&conn, id)?;
        result.push(WorkoutTemplate {
            id,
            name,
            description,
            trainer_name,
            exercises,
        });
    }

    Ok(result)
}

/// Создать шаблон тренировки
#[tauri::command]
pub fn create_workout_template(
    state: State<'_, Database>,
    name: String,
    description: Option<String>,
    trainer_id: Option<i64>,
    exercises: Vec<CreateWorkoutExercise>,
) -> Result<String, String> {
    if name.trim().is_empty() {
        return Err("Введите название шаблона".to_string());
    }

    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let now = utils::now_iso();

    conn.execute(
        "INSERT INTO workout_templates (name, description, trainer_id, is_active, created_at) VALUES (?1, ?2, ?3, 1, ?4)",
        rusqlite::params![name.trim(), description, trainer_id, now],
    ).map_err(|e| format!("Ошибка: {}", e))?;

    let template_id = conn.last_insert_rowid();

    // Добавляем упражнения в шаблон
    for ex in &exercises {
        conn.execute(
            "INSERT INTO workout_template_exercises (template_id, exercise_id, order_index, default_sets, default_reps, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                template_id,
                ex.exercise_id,
                ex.order_index,
                3, // default sets из sets_data не парсим — используем 3
                10, // default reps
                ex.notes,
            ],
        ).map_err(|e| format!("Ошибка добавления упражнения: {}", e))?;
    }

    Ok("Шаблон создан".to_string())
}

// ============================================================
// Тренировки клиентов
// ============================================================

/// Получить тренировки клиента
#[tauri::command]
pub fn get_client_workouts(
    state: State<'_, Database>,
    client_id: i64,
    limit: Option<i64>,
) -> Result<Vec<Workout>, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let max_rows = limit.unwrap_or(50);

    let mut stmt = conn.prepare(
        "SELECT w.id, w.client_id,
                c.last_name || ' ' || c.first_name as client_name,
                u.full_name as trainer_name,
                wt.name as template_name,
                w.workout_date, w.notes
         FROM workouts w
         JOIN clients c ON w.client_id = c.id
         LEFT JOIN users u ON w.trainer_id = u.id
         LEFT JOIN workout_templates wt ON w.template_id = wt.id
         WHERE w.client_id = ?1
         ORDER BY w.workout_date DESC
         LIMIT ?2"
    ).map_err(|e| format!("Ошибка: {}", e))?;

    let workouts_raw: Vec<(i64, i64, String, Option<String>, Option<String>, String, Option<String>)> =
        stmt.query_map(rusqlite::params![client_id, max_rows], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?))
        }).map_err(|e| format!("Ошибка: {}", e))?
          .filter_map(|w| w.ok())
          .collect();

    let mut result = Vec::new();
    for (id, cid, client_name, trainer_name, template_name, workout_date, notes) in workouts_raw {
        let exercises = get_workout_exercises_internal(&conn, id)?;
        result.push(Workout {
            id,
            client_id: cid,
            client_name,
            trainer_name,
            template_name,
            workout_date,
            notes,
            exercises,
        });
    }

    Ok(result)
}

/// Создать тренировку клиента
#[tauri::command]
pub fn create_workout(
    state: State<'_, Database>,
    request: CreateWorkoutRequest,
) -> Result<String, String> {
    let conn = state.conn.lock()
        .map_err(|_| "Ошибка доступа к базе данных".to_string())?;

    let now = utils::now_iso();

    conn.execute(
        "INSERT INTO workouts (client_id, trainer_id, template_id, workout_date, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            request.client_id,
            request.trainer_id,
            request.template_id,
            request.workout_date,
            request.notes,
            now,
        ],
    ).map_err(|e| format!("Ошибка создания тренировки: {}", e))?;

    let workout_id = conn.last_insert_rowid();

    for ex in &request.exercises {
        conn.execute(
            "INSERT INTO workout_exercises (workout_id, exercise_id, order_index, sets_data, notes)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![workout_id, ex.exercise_id, ex.order_index, ex.sets_data, ex.notes],
        ).map_err(|e| format!("Ошибка добавления упражнения: {}", e))?;
    }

    Ok("Тренировка записана".to_string())
}

// ============================================================
// Вспомогательные функции
// ============================================================

fn get_template_exercises_internal(conn: &rusqlite::Connection, template_id: i64) -> Result<Vec<TemplateExercise>, String> {
    let mut stmt = conn.prepare(
        "SELECT wte.id, wte.exercise_id, e.name, e.muscle_group,
                wte.order_index, wte.default_sets, wte.default_reps, wte.notes
         FROM workout_template_exercises wte
         JOIN exercises e ON wte.exercise_id = e.id
         WHERE wte.template_id = ?1
         ORDER BY wte.order_index"
    ).map_err(|e| format!("Ошибка: {}", e))?;

    let exercises = stmt.query_map(rusqlite::params![template_id], |row| {
        Ok(TemplateExercise {
            id: row.get(0)?,
            exercise_id: row.get(1)?,
            exercise_name: row.get(2)?,
            muscle_group: row.get(3)?,
            order_index: row.get(4)?,
            default_sets: row.get(5)?,
            default_reps: row.get(6)?,
            notes: row.get(7)?,
        })
    }).map_err(|e| format!("Ошибка: {}", e))?;

    Ok(exercises.filter_map(|e| e.ok()).collect())
}

fn get_workout_exercises_internal(conn: &rusqlite::Connection, workout_id: i64) -> Result<Vec<WorkoutExercise>, String> {
    let mut stmt = conn.prepare(
        "SELECT we.id, we.exercise_id, e.name, e.muscle_group,
                we.order_index, we.sets_data, we.notes
         FROM workout_exercises we
         JOIN exercises e ON we.exercise_id = e.id
         WHERE we.workout_id = ?1
         ORDER BY we.order_index"
    ).map_err(|e| format!("Ошибка: {}", e))?;

    let exercises = stmt.query_map(rusqlite::params![workout_id], |row| {
        Ok(WorkoutExercise {
            id: row.get(0)?,
            exercise_id: row.get(1)?,
            exercise_name: row.get(2)?,
            muscle_group: row.get(3)?,
            order_index: row.get(4)?,
            sets_data: row.get(5)?,
            notes: row.get(6)?,
        })
    }).map_err(|e| format!("Ошибка: {}", e))?;

    Ok(exercises.filter_map(|e| e.ok()).collect())
}