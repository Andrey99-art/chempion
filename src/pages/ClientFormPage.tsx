// src/pages/ClientFormPage.tsx
//
// Форма добавления нового клиента или редактирования существующего.
// Используется React Hook Form + Zod для валидации.
// При редактировании — подгружает данные клиента и заполняет форму.

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save } from "lucide-react";
import { clientSchema, type ClientFormValues } from "../lib/validators";
import { createClient, updateClient, getClient, getTrainers } from "../lib/tauri";
import { useUIStore } from "../store/uiStore";
import type { User } from "../types";

interface ClientFormPageProps {
  /** ID клиента для редактирования (null = создание нового) */
  readonly clientId?: number | null;
  /** Навигация назад */
  readonly onNavigate: (page: string, id?: number) => void;
}

export default function ClientFormPage({ clientId, onNavigate }: ClientFormPageProps) {
  const isEditing = clientId != null;
  const addNotification = useUIStore((state) => state.addNotification);

  const [trainers, setTrainers] = useState<User[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(isEditing);

  // Инициализация формы с Zod-валидацией
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      last_name: "",
      first_name: "",
      middle_name: "",
      phone: "",
      birth_date: "",
      trainer_id: null,
      medical_notes: "",
      notes: "",
    },
  });

  // Загружаем список тренеров при монтировании
  useEffect(() => {
    getTrainers()
      .then(setTrainers)
      .catch(() => {});
  }, []);

  // При редактировании — загружаем данные клиента и заполняем форму
  useEffect(() => {
    if (!isEditing || !clientId) return;

    setIsLoadingClient(true);
    getClient(clientId)
      .then((client) => {
        reset({
          last_name: client.last_name,
          first_name: client.first_name,
          middle_name: client.middle_name ?? "",
          phone: client.phone ?? "",
          birth_date: client.birth_date ?? "",
          trainer_id: client.trainer_id,
          medical_notes: client.medical_notes ?? "",
          notes: client.notes ?? "",
        });
      })
      .catch((err) => {
        const message = typeof err === "string" ? err : "Ошибка загрузки клиента";
        addNotification("error", message);
      })
      .finally(() => setIsLoadingClient(false));
  }, [clientId, isEditing, reset, addNotification]);

  // Обработчик отправки формы
  const onSubmit = async (data: ClientFormValues) => {
    setIsSubmitting(true);
    try {
      // Преобразуем пустые строки и undefined в null для бэкенда
      const payload = {
        last_name: data.last_name,
        first_name: data.first_name,
        middle_name: data.middle_name || null,
        phone: data.phone || null,
        birth_date: data.birth_date || null,
        trainer_id: data.trainer_id ?? null,
        medical_notes: data.medical_notes || null,
        notes: data.notes || null,
      };

      if (isEditing && clientId) {
        await updateClient(clientId, payload);
        addNotification("success", "Клиент обновлён");
        onNavigate("client-detail", clientId);
      } else {
        const newClient = await createClient(payload);
        addNotification("success", "Клиент добавлен");
        onNavigate("client-detail", newClient.id);
      }
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка сохранения";
      addNotification("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Показываем загрузку при редактировании
  if (isLoadingClient) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-400">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* --- Заголовок с кнопкой "Назад" --- */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onNavigate("clients")}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
          aria-label="Назад к списку клиентов"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {isEditing ? "Редактирование клиента" : "Новый клиент"}
        </h1>
      </div>

      {/* --- Форма --- */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-lg bg-white p-6 shadow-sm"
      >
        {/* ФИО — три поля в ряд */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Фамилия (обязательное) */}
          <div>
            <label htmlFor="last_name" className="mb-1 block text-sm font-medium text-slate-700">
              Фамилия <span className="text-red-500">*</span>
            </label>
            <input
              id="last_name"
              type="text"
              {...register("last_name")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Иванов"
            />
            {errors.last_name && (
              <p className="mt-1 text-xs text-red-500">{errors.last_name.message}</p>
            )}
          </div>

          {/* Имя (обязательное) */}
          <div>
            <label htmlFor="first_name" className="mb-1 block text-sm font-medium text-slate-700">
              Имя <span className="text-red-500">*</span>
            </label>
            <input
              id="first_name"
              type="text"
              {...register("first_name")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Иван"
            />
            {errors.first_name && (
              <p className="mt-1 text-xs text-red-500">{errors.first_name.message}</p>
            )}
          </div>

          {/* Отчество (необязательное) */}
          <div>
            <label htmlFor="middle_name" className="mb-1 block text-sm font-medium text-slate-700">
              Отчество
            </label>
            <input
              id="middle_name"
              type="text"
              {...register("middle_name")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Иванович"
            />
          </div>
        </div>

        {/* Телефон + Дата рождения */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
              Телефон
            </label>
            <input
              id="phone"
              type="tel"
              {...register("phone")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="+375 (29) 123-45-67"
            />
          </div>

          <div>
            <label htmlFor="birth_date" className="mb-1 block text-sm font-medium text-slate-700">
              Дата рождения
            </label>
            <input
              id="birth_date"
              type="date"
              {...register("birth_date")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Тренер */}
        <div>
          <label htmlFor="trainer_id" className="mb-1 block text-sm font-medium text-slate-700">
            Тренер
          </label>
          <select
            id="trainer_id"
            {...register("trainer_id", {
              setValueAs: (v: string) => (v === "" ? null : Number(v)),
            })}
            aria-label="Выбор тренера"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Без тренера</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>
                {trainer.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Медицинские заметки */}
        <div>
          <label htmlFor="medical_notes" className="mb-1 block text-sm font-medium text-slate-700">
            Медицинские ограничения
          </label>
          <textarea
            id="medical_notes"
            rows={2}
            {...register("medical_notes")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Проблемы со спиной, противопоказания..."
          />
        </div>

        {/* Произвольные заметки */}
        <div>
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
            Заметки
          </label>
          <textarea
            id="notes"
            rows={2}
            {...register("notes")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Любые заметки о клиенте..."
          />
        </div>

        {/* Кнопки */}
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => onNavigate("clients")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}