// src/pages/ImportPage.tsx
//
// Страница импорта клиентов из Excel.
// Шаги: 1) Выбор файла → 2) Маппинг столбцов → 3) Предпросмотр → 4) Результат.

import { useState } from "react";
import { FileSpreadsheet, Upload, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  getExcelColumns,
  previewImport,
  executeImport,
  type ColumnMapping,
} from "../lib/tauri";
import { useUIStore } from "../store/uiStore";
import type { ImportPreviewRow, ImportResult } from "../types";

/** Шаги импорта */
type ImportStep = "select" | "mapping" | "preview" | "result";

export default function ImportPage() {
  const addNotification = useUIStore((state) => state.addNotification);

  const [step, setStep] = useState<ImportStep>("select");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [columns, setColumns] = useState<readonly string[]>([]);
  const [previewRows, setPreviewRows] = useState<readonly ImportPreviewRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Маппинг столбцов
  const [fioMode, setFioMode] = useState<"single" | "separate">("single");
  const [fioCol, setFioCol] = useState<number | null>(null);
  const [lastNameCol, setLastNameCol] = useState<number | null>(null);
  const [firstNameCol, setFirstNameCol] = useState<number | null>(null);
  const [middleNameCol, setMiddleNameCol] = useState<number | null>(null);
  const [phoneCol, setPhoneCol] = useState<number | null>(null);
  const [birthDateCol, setBirthDateCol] = useState<number | null>(null);

  // Шаг 1: Выбор файла
  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
      });

      if (!selected) return;

      const path = typeof selected === "string" ? selected : selected;
      setFilePath(path);
      setIsLoading(true);

      const cols = await getExcelColumns(path);
      setColumns(cols);
      setStep("mapping");
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка открытия файла";
      addNotification("error", message);
    } finally {
      setIsLoading(false);
    }
  };

  // Шаг 2 → 3: Предпросмотр
  const handlePreview = async () => {
    if (!filePath) return;

    const mapping: ColumnMapping = {
      fio_column: fioMode === "single" ? fioCol : null,
      last_name_column: fioMode === "separate" ? lastNameCol : null,
      first_name_column: fioMode === "separate" ? firstNameCol : null,
      middle_name_column: fioMode === "separate" ? middleNameCol : null,
      phone_column: phoneCol,
      birth_date_column: birthDateCol,
      start_row: 1, // пропускаем заголовок
    };

    // Валидация маппинга
    if (fioMode === "single" && fioCol === null) {
      addNotification("warning", "Укажите столбец с ФИО");
      return;
    }
    if (fioMode === "separate" && (lastNameCol === null || firstNameCol === null)) {
      addNotification("warning", "Укажите столбцы фамилии и имени");
      return;
    }

    setIsLoading(true);
    try {
      const rows = await previewImport(filePath, mapping);
      setPreviewRows(rows);
      setStep("preview");
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка чтения файла";
      addNotification("error", message);
    } finally {
      setIsLoading(false);
    }
  };

  // Шаг 3 → 4: Импорт
  const handleImport = async () => {
    const validRows = previewRows.filter((r) => r.is_valid);
    if (validRows.length === 0) {
      addNotification("warning", "Нет валидных строк для импорта");
      return;
    }

    setIsLoading(true);
    try {
      // Нужно передать mutable массив — убираем readonly
      const result = await executeImport([...validRows]);
      setImportResult(result);
      setStep("result");
      addNotification("success", `Импортировано: ${result.imported}`);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка импорта";
      addNotification("error", message);
    } finally {
      setIsLoading(false);
    }
  };

  // Сброс — начать заново
  const handleReset = () => {
    setStep("select");
    setFilePath(null);
    setColumns([]);
    setPreviewRows([]);
    setImportResult(null);
    setFioCol(null);
    setLastNameCol(null);
    setFirstNameCol(null);
    setMiddleNameCol(null);
    setPhoneCol(null);
    setBirthDateCol(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Импорт из Excel</h1>

      {/* Индикатор шагов */}
      <StepIndicator current={step} />

      <div className="rounded-lg bg-white p-6 shadow-sm">
        {step === "select" && (
          <SelectFileStep onSelect={handleSelectFile} isLoading={isLoading} />
        )}
        {step === "mapping" && (
          <MappingStep
            columns={columns}
            fioMode={fioMode}
            onFioModeChange={setFioMode}
            fioCol={fioCol}
            onFioColChange={setFioCol}
            lastNameCol={lastNameCol}
            onLastNameColChange={setLastNameCol}
            firstNameCol={firstNameCol}
            onFirstNameColChange={setFirstNameCol}
            middleNameCol={middleNameCol}
            onMiddleNameColChange={setMiddleNameCol}
            phoneCol={phoneCol}
            onPhoneColChange={setPhoneCol}
            birthDateCol={birthDateCol}
            onBirthDateColChange={setBirthDateCol}
            onNext={handlePreview}
            onBack={handleReset}
            isLoading={isLoading}
          />
        )}
        {step === "preview" && (
          <PreviewStep
            rows={previewRows}
            onImport={handleImport}
            onBack={() => setStep("mapping")}
            isLoading={isLoading}
          />
        )}
        {step === "result" && (
          <ResultStep result={importResult} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}

// === Индикатор шагов ===

function StepIndicator({ current }: { readonly current: ImportStep }) {
  const steps = [
    { id: "select", label: "Файл" },
    { id: "mapping", label: "Столбцы" },
    { id: "preview", label: "Предпросмотр" },
    { id: "result", label: "Результат" },
  ];

  const currentIdx = steps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, idx) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              idx <= currentIdx
                ? "bg-blue-600 text-white"
                : "bg-slate-200 text-slate-500"
            }`}
          >
            {idx + 1}
          </div>
          <span className={`text-sm ${idx <= currentIdx ? "font-medium text-slate-900" : "text-slate-400"}`}>
            {s.label}
          </span>
          {idx < steps.length - 1 && <ArrowRight className="h-4 w-4 text-slate-300" />}
        </div>
      ))}
    </div>
  );
}

// === Шаг 1: Выбор файла ===

function SelectFileStep({
  onSelect,
  isLoading,
}: {
  readonly onSelect: () => void;
  readonly isLoading: boolean;
}) {
  return (
    <div className="py-12 text-center">
      <FileSpreadsheet className="mx-auto mb-4 h-16 w-16 text-slate-300" />
      <h2 className="mb-2 text-lg font-semibold text-slate-700">Выберите Excel-файл</h2>
      <p className="mb-6 text-sm text-slate-500">Поддерживаются файлы .xlsx и .xls</p>
      <button
        type="button"
        onClick={onSelect}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        {isLoading ? "Чтение файла..." : "Выбрать файл"}
      </button>
    </div>
  );
}

// === Шаг 2: Маппинг столбцов ===

function MappingStep({
  columns,
  fioMode,
  onFioModeChange,
  fioCol,
  onFioColChange,
  lastNameCol,
  onLastNameColChange,
  firstNameCol,
  onFirstNameColChange,
  middleNameCol,
  onMiddleNameColChange,
  phoneCol,
  onPhoneColChange,
  birthDateCol,
  onBirthDateColChange,
  onNext,
  onBack,
  isLoading,
}: {
  readonly columns: readonly string[];
  readonly fioMode: "single" | "separate";
  readonly onFioModeChange: (mode: "single" | "separate") => void;
  readonly fioCol: number | null;
  readonly onFioColChange: (col: number | null) => void;
  readonly lastNameCol: number | null;
  readonly onLastNameColChange: (col: number | null) => void;
  readonly firstNameCol: number | null;
  readonly onFirstNameColChange: (col: number | null) => void;
  readonly middleNameCol: number | null;
  readonly onMiddleNameColChange: (col: number | null) => void;
  readonly phoneCol: number | null;
  readonly onPhoneColChange: (col: number | null) => void;
  readonly birthDateCol: number | null;
  readonly onBirthDateColChange: (col: number | null) => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
  readonly isLoading: boolean;
}) {
  const colOptions = columns.map((name, idx) => ({ value: idx, label: `${idx + 1}: ${name || "(пусто)"}` }));

  const selectClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-700">Укажите столбцы</h2>
      <p className="text-sm text-slate-500">
        Найдено {columns.length} столбцов. Укажите какой столбец соответствует какому полю.
      </p>

      {/* Режим ФИО */}
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Как записано ФИО?</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="radio"
              checked={fioMode === "single"}
              onChange={() => onFioModeChange("single")}
            />{" "}
            В одном столбце (Иванов Иван Иванович)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="radio"
              checked={fioMode === "separate"}
              onChange={() => onFioModeChange("separate")}
            />{" "}
            В отдельных столбцах
          </label>
        </div>
      </div>

      {/* Выбор столбцов */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fioMode === "single" ? (
          <ColumnSelect label="Столбец с ФИО *" value={fioCol} options={colOptions} onChange={onFioColChange} className={selectClass} />
        ) : (
          <>
            <ColumnSelect label="Фамилия *" value={lastNameCol} options={colOptions} onChange={onLastNameColChange} className={selectClass} />
            <ColumnSelect label="Имя *" value={firstNameCol} options={colOptions} onChange={onFirstNameColChange} className={selectClass} />
            <ColumnSelect label="Отчество" value={middleNameCol} options={colOptions} onChange={onMiddleNameColChange} className={selectClass} />
          </>
        )}
        <ColumnSelect label="Телефон" value={phoneCol} options={colOptions} onChange={onPhoneColChange} className={selectClass} />
        <ColumnSelect label="Дата рождения" value={birthDateCol} options={colOptions} onChange={onBirthDateColChange} className={selectClass} />
      </div>

      {/* Кнопки */}
      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isLoading ? "Чтение..." : "Предпросмотр"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// === Выпадающий список столбца ===

function ColumnSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  readonly label: string;
  readonly value: number | null;
  readonly options: readonly { readonly value: number; readonly label: string }[];
  readonly onChange: (val: number | null) => void;
  readonly className: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-label={label}
        className={className}
      >
        <option value="">— не выбрано —</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// === Шаг 3: Предпросмотр ===

function PreviewStep({
  rows,
  onImport,
  onBack,
  isLoading,
}: {
  readonly rows: readonly ImportPreviewRow[];
  readonly onImport: () => void;
  readonly onBack: () => void;
  readonly isLoading: boolean;
}) {
  const validCount = rows.filter((r) => r.is_valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Предпросмотр</h2>
        <div className="flex gap-3 text-sm">
          <span className="text-green-600">Готово к импорту: {validCount}</span>
          {invalidCount > 0 && <span className="text-red-500">С ошибками: {invalidCount}</span>}
        </div>
      </div>

      {/* Таблица */}
      <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="sticky top-0">
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Стр.</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Фамилия</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Имя</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Отчество</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Телефон</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.row_number} className={row.is_valid ? "" : "bg-red-50"}>
                <td className="px-3 py-2 text-xs text-slate-400">{row.row_number}</td>
                <td className="px-3 py-2 text-sm text-slate-900">{row.last_name}</td>
                <td className="px-3 py-2 text-sm text-slate-900">{row.first_name}</td>
                <td className="px-3 py-2 text-sm text-slate-500">{row.middle_name ?? "—"}</td>
                <td className="px-3 py-2 text-sm text-slate-500">{row.phone ?? "—"}</td>
                <td className="px-3 py-2">
                  {row.is_valid ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <span className="text-xs text-red-500">{row.errors.join(", ")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Кнопки */}
      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={isLoading || validCount === 0}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {isLoading ? "Импорт..." : `Импортировать ${validCount} клиентов`}
        </button>
      </div>
    </div>
  );
}

// === Шаг 4: Результат ===

function ResultStep({
  result,
  onReset,
}: {
  readonly result: ImportResult | null;
  readonly onReset: () => void;
}) {
  if (!result) return null;

  return (
    <div className="py-8 text-center">
      <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
      <h2 className="mb-2 text-lg font-semibold text-slate-700">Импорт завершён</h2>
      <div className="mb-6 space-y-1 text-sm text-slate-600">
        <p>Импортировано: <span className="font-semibold text-green-600">{result.imported}</span></p>
        {result.skipped > 0 && (
          <p>Пропущено: <span className="font-semibold text-amber-600">{result.skipped}</span></p>
        )}
      </div>

      {result.errors.length > 0 && (
        <div className="mx-auto mb-6 max-w-lg rounded-lg bg-red-50 p-4 text-left">
          <p className="mb-2 text-sm font-medium text-red-700">Ошибки:</p>
          <ul className="space-y-1 text-xs text-red-600">
            {result.errors.map((err, idx) => (
              <li key={idx}>• {err}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Импортировать ещё
      </button>
    </div>
  );
}