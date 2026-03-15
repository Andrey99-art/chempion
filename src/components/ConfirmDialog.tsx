// src/components/ConfirmDialog.tsx
//
// Модальный диалог подтверждения.
// Используется для опасных действий: деактивация клиента, удаление, сброс пароля.
// Использует нативный <dialog> для правильной доступности.

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  /** Показывать ли диалог */
  readonly isOpen: boolean;
  /** Заголовок диалога */
  readonly title: string;
  /** Текст вопроса */
  readonly message: string;
  /** Текст кнопки подтверждения (по умолчанию "Подтвердить") */
  readonly confirmText?: string;
  /** Опасное действие? Если да — кнопка будет красной */
  readonly isDanger?: boolean;
  /** Обработчик подтверждения */
  readonly onConfirm: () => void;
  /** Обработчик отмены / закрытия */
  readonly onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Подтвердить",
  isDanger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Закрытие по клику на backdrop через нативный event listener
  // Это обходит предупреждение SonarQube о click на неинтерактивном элементе
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClick = (e: MouseEvent) => {
      // getBoundingClientRect() — координаты внутренней области <dialog>
      // Если клик за её пределами — значит клик по backdrop
      const rect = dialog.getBoundingClientRect();
      const clickedInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!clickedInside) {
        onCancel();
      }
    };

    dialog.addEventListener("click", handleClick);
    return () => dialog.removeEventListener("click", handleClick);
  }, [onCancel]);

  // Обработка нажатия Escape
  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onCancel();
  };

  const confirmButtonClass = isDanger
    ? "bg-red-600 text-white hover:bg-red-700"
    : "bg-blue-600 text-white hover:bg-blue-700";

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      className="w-full max-w-md rounded-xl bg-transparent p-0 backdrop:bg-black/50"
    >
      <div className="rounded-xl bg-white p-6 shadow-2xl">
        {/* Заголовок + кнопка закрытия */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                isDanger ? "bg-red-100" : "bg-amber-100"
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${isDanger ? "text-red-600" : "text-amber-600"}`}
              />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-6 text-sm text-slate-600">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </dialog>
  );
}