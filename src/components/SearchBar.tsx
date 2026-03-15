// src/components/SearchBar.tsx
//
// Компонент поиска клиентов.
// Используется в таблице клиентов и на странице посещений.
// При вводе текста — вызывает callback с задержкой (debounce),
// чтобы не делать запрос на каждую букву.

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  /** Текущее значение поиска */
  readonly value: string;
  /** Callback при изменении значения (уже с debounce) */
  readonly onChange: (value: string) => void;
  /** Placeholder текст */
  readonly placeholder?: string;
  /** Задержка debounce в мс (по умолчанию 300) */
  readonly debounceMs?: number;
  /** Автофокус при монтировании */
  readonly autoFocus?: boolean;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Поиск по ФИО или телефону...",
  debounceMs = 300,
  autoFocus = false,
}: SearchBarProps) {
  // Локальное значение инпута (обновляется мгновенно при вводе)
  const [localValue, setLocalValue] = useState(value);

  // Ссылка на таймер debounce (для отмены при новом вводе)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Синхронизируем локальное значение если внешнее изменилось
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Обработчик ввода с debounce
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue); // обновляем UI мгновенно

    // Отменяем предыдущий таймер
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Запускаем новый таймер — callback вызовется через debounceMs
    debounceTimer.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  };

  // Очистка поля поиска
  const handleClear = () => {
    setLocalValue("");
    onChange("");
  };

  // Очищаем таймер при размонтировании компонента
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      {/* Иконка лупы слева */}
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

      {/* Поле ввода */}
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-9 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />

      {/* Кнопка очистки (крестик) — показывается только если есть текст */}
      {localValue.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-slate-600"
          aria-label="Очистить поиск"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}