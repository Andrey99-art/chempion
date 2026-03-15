// src/components/WorkoutsTab.tsx
//
// Вкладка "Тренировки" в карточке клиента.
// История тренировок + создание новой тренировки.

import { useCallback, useEffect, useState } from "react";
import { Plus, Dumbbell, ChevronDown, ChevronUp } from "lucide-react";
import {
  getClientWorkouts,
  getExercises,
  createWorkout,
  type Workout,
  type Exercise,
  type SetData,
} from "../lib/tauri";
import { formatDateShort } from "../lib/formatters";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";

interface WorkoutsTabProps {
  readonly clientId: number;
}

export default function WorkoutsTab({ clientId }: WorkoutsTabProps) {
  const user = useAuthStore((state) => state.user);
  const addNotification = useUIStore((state) => state.addNotification);

  const [workouts, setWorkouts] = useState<readonly Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadWorkouts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getClientWorkouts(clientId, 50);
      setWorkouts(data);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка загрузки";
      addNotification("error", message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, addNotification]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  const handleCreated = () => {
    setShowForm(false);
    loadWorkouts();
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Записать тренировку
        </button>
      </div>

      {showForm && (
        <WorkoutForm
          clientId={clientId}
          trainerId={user?.id ?? null}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {workouts.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Тренировок пока нет</p>
      ) : (
        <div className="space-y-3">
          {workouts.map((workout) => (
            <WorkoutCard key={workout.id} workout={workout} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Карточка одной тренировки — сворачиваемая */
function WorkoutCard({ workout }: { readonly workout: Workout }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100">
            <Dumbbell className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {formatDateShort(workout.workout_date)}
              {workout.template_name && (
                <span className="ml-2 text-slate-500">· {workout.template_name}</span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              {workout.exercises.length} упражнений
              {workout.trainer_name && ` · Тренер: ${workout.trainer_name}`}
            </p>
          </div>
        </div>
        {isExpanded
          ? <ChevronUp className="h-4 w-4 text-slate-400" />
          : <ChevronDown className="h-4 w-4 text-slate-400" />
        }
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-4 py-3">
          {workout.notes && (
            <p className="mb-3 text-sm text-slate-600">📝 {workout.notes}</p>
          )}
          <div className="space-y-2">
            {workout.exercises.map((ex) => {
              const sets: SetData[] = JSON.parse(ex.sets_data || "[]");
              return (
                <div key={ex.id} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">{ex.exercise_name}</p>
                    {ex.muscle_group && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                        {ex.muscle_group}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sets.map((set, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm"
                      >
                        {set.weight}кг × {set.reps}
                      </span>
                    ))}
                  </div>
                  {ex.notes && (
                    <p className="mt-1 text-xs text-slate-500">{ex.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Форма создания тренировки */
function WorkoutForm({
  clientId,
  trainerId,
  onCreated,
  onCancel,
}: {
  readonly clientId: number;
  readonly trainerId: number | null;
  readonly onCreated: () => void;
  readonly onCancel: () => void;
}) {
  const addNotification = useUIStore((state) => state.addNotification);

  const [exercises, setExercises] = useState<readonly Exercise[]>([]);
  const [workoutDate, setWorkoutDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<WorkoutExerciseForm[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Загрузка справочника упражнений
  useEffect(() => {
    getExercises().then(setExercises).catch(() => {});
  }, []);

  // Добавить упражнение в тренировку
  const handleAddExercise = (exerciseId: number) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    setSelectedExercises((prev) => [
      ...prev,
      {
        exercise_id: exerciseId,
        exercise_name: ex.name,
        sets: [{ weight: 0, reps: 10 }],
        notes: "",
      },
    ]);
  };

  // Добавить подход к упражнению
  const handleAddSet = (exIndex: number) => {
    setSelectedExercises((prev) => {
      const updated = [...prev];
      const lastSet = updated[exIndex].sets[updated[exIndex].sets.length - 1];
      updated[exIndex] = {
        ...updated[exIndex],
        sets: [...updated[exIndex].sets, { weight: lastSet?.weight ?? 0, reps: lastSet?.reps ?? 10 }],
      };
      return updated;
    });
  };

  // Обновить подход
  const handleUpdateSet = (exIndex: number, setIndex: number, field: "weight" | "reps", value: number) => {
    setSelectedExercises((prev) => {
      const updated = [...prev];
      const sets = [...updated[exIndex].sets];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      updated[exIndex] = { ...updated[exIndex], sets };
      return updated;
    });
  };

  // Удалить упражнение
  const handleRemoveExercise = (exIndex: number) => {
    setSelectedExercises((prev) => prev.filter((_, i) => i !== exIndex));
  };

  // Сохранить тренировку
  const handleSubmit = async () => {
    if (selectedExercises.length === 0) {
      addNotification("warning", "Добавьте хотя бы одно упражнение");
      return;
    }

    setIsSubmitting(true);
    try {
      await createWorkout({
        client_id: clientId,
        trainer_id: trainerId,
        template_id: null,
        workout_date: workoutDate,
        notes: workoutNotes.trim() || null,
        exercises: selectedExercises.map((ex, idx) => ({
          exercise_id: ex.exercise_id,
          order_index: idx,
          sets_data: JSON.stringify(ex.sets),
          notes: ex.notes.trim() || null,
        })),
      });
      addNotification("success", "Тренировка записана");
      onCreated();
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка сохранения";
      addNotification("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h4 className="mb-4 text-sm font-semibold text-slate-700">Новая тренировка</h4>

      {/* Дата и заметки */}
      <div className="mb-4 flex gap-3">
        <div>
          <label htmlFor="w-date" className="mb-1 block text-xs font-medium text-slate-600">Дата</label>
          <input
            id="w-date"
            type="date"
            value={workoutDate}
            onChange={(e) => setWorkoutDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="w-notes" className="mb-1 block text-xs font-medium text-slate-600">Заметки</label>
          <input
            id="w-notes"
            type="text"
            value={workoutNotes}
            onChange={(e) => setWorkoutNotes(e.target.value)}
            placeholder="Общие заметки к тренировке..."
            className={`w-full ${inputClass}`}
          />
        </div>
      </div>

      {/* Добавление упражнения */}
      <div className="mb-4">
        <label htmlFor="add-exercise" className="mb-1 block text-xs font-medium text-slate-600">
          Добавить упражнение
        </label>
        <select
          id="add-exercise"
          onChange={(e) => {
            if (e.target.value) {
              handleAddExercise(Number(e.target.value));
              e.target.value = "";
            }
          }}
          aria-label="Выбрать упражнение"
          className={`w-full ${inputClass}`}
        >
          <option value="">Выберите упражнение...</option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name} {ex.muscle_group ? `(${ex.muscle_group})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Список добавленных упражнений */}
      {selectedExercises.length > 0 && (
        <div className="mb-4 space-y-3">
          {selectedExercises.map((ex, exIndex) => (
            <div key={exIndex} className="rounded-lg bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">{ex.exercise_name}</p>
                <button
                  type="button"
                  onClick={() => handleRemoveExercise(exIndex)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Удалить
                </button>
              </div>

              {/* Подходы */}
              <div className="space-y-1">
                {ex.sets.map((set, setIndex) => (
                  <div key={setIndex} className="flex items-center gap-2">
                    <span className="w-6 text-xs text-slate-400">{setIndex + 1}.</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={set.weight}
                      onChange={(e) => handleUpdateSet(exIndex, setIndex, "weight", Number(e.target.value))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                      aria-label={`Вес подхода ${setIndex + 1}`}
                    />
                    <span className="text-xs text-slate-500">кг ×</span>
                    <input
                      type="number"
                      min="0"
                      value={set.reps}
                      onChange={(e) => handleUpdateSet(exIndex, setIndex, "reps", Number(e.target.value))}
                      className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                      aria-label={`Повторения подхода ${setIndex + 1}`}
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleAddSet(exIndex)}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              >
                + Добавить подход
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Кнопки */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isSubmitting ? "Сохранение..." : "Записать тренировку"}
        </button>
      </div>
    </div>
  );
}

/** Тип для формы */
interface WorkoutExerciseForm {
  exercise_id: number;
  exercise_name: string;
  sets: SetData[];
  notes: string;
}