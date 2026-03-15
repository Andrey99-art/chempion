// src/pages/ClientDetailPage.tsx
//
// Карточка клиента — полная информация с вкладками.

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Pencil,
  UserX,
  UserCheck,
  Phone,
  Calendar,
  User as UserIcon,
  Stethoscope,
  StickyNote,
  Camera,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  getClient,
  toggleClientActive,
  getClientPhotoBase64,
  uploadClientPhoto,
} from "../lib/tauri";
import { formatDate, formatPhone, formatFullName } from "../lib/formatters";
import { useUIStore } from "../store/uiStore";
import ConfirmDialog from "../components/ConfirmDialog";
import SubscriptionsTab from "../components/SubscriptionsTab";
import PaymentsTab from "../components/PaymentsTab";
import VisitsTab from "../components/VisitsTab";
import type { Client } from "../types";
import WorkoutsTab from "../components/WorkoutsTab";

/** Названия вкладок */
const TABS = [
  { id: "info", label: "Информация" },
  { id: "subscriptions", label: "Абонементы" },
  { id: "payments", label: "Оплаты" },
  { id: "visits", label: "Посещения" },
  { id: "workouts", label: "Тренировки" },
  { id: "notes", label: "Заметки" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface ClientDetailPageProps {
  readonly clientId: number;
  readonly onNavigate: (page: string, id?: number) => void;
}

/** Фото клиента с возможностью загрузки */
function ClientPhoto({ clientId }: { readonly clientId: number }) {
  const addNotification = useUIStore((state) => state.addNotification);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);

  useEffect(() => {
    getClientPhotoBase64(clientId).then((data) => {
      if (data) setPhotoSrc(data);
    }).catch(() => {});
  }, [clientId]);

  const handleUpload = async () => {
    try {
      const file = await openDialog({
        multiple: false,
        title: "Выберите фото",
        filters: [{ name: "Изображения", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
      });
      if (!file || typeof file !== "string") return;

      await uploadClientPhoto(clientId, file);
      const newData = await getClientPhotoBase64(clientId);
      if (newData) setPhotoSrc(newData);
      addNotification("success", "Фото обновлено");
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка загрузки фото";
      addNotification("error", message);
    }
  };

  return (
    <button
      type="button"
      onClick={handleUpload}
      className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200"
      title="Нажмите чтобы загрузить фото"
    >
      {photoSrc ? (
        <img src={photoSrc} alt="Фото" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-400">
          <UserIcon className="h-8 w-8" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
        <Camera className="h-5 w-5 text-white" />
      </div>
    </button>
  );
}

export default function ClientDetailPage({ clientId, onNavigate }: ClientDetailPageProps) {
  const addNotification = useUIStore((state) => state.addNotification);

  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    getClient(clientId)
      .then(setClient)
      .catch((err) => {
        const message = typeof err === "string" ? err : "Ошибка загрузки";
        addNotification("error", message);
      })
      .finally(() => setIsLoading(false));
  }, [clientId, addNotification]);

  const handleToggleActive = async () => {
    setShowDeactivateDialog(false);
    try {
      await toggleClientActive(clientId);
      const updated = await getClient(clientId);
      setClient(updated);
      addNotification(
        "success",
        updated.is_active ? "Клиент активирован" : "Клиент деактивирован",
      );
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка";
      addNotification("error", message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-400">Загрузка...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-400">Клиент не найден</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* --- Шапка: фото + ФИО + действия --- */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate("clients")}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
            aria-label="Назад к списку клиентов"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <ClientPhoto clientId={clientId} />

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {formatFullName(client.last_name, client.first_name, client.middle_name)}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              {client.is_active ? (
                <span className="text-sm text-green-600">Активный клиент</span>
              ) : (
                <span className="text-sm text-red-500">Деактивирован</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onNavigate("client-form", clientId)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
            Редактировать
          </button>
          <button
            type="button"
            onClick={() => setShowDeactivateDialog(true)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              client.is_active
                ? "border border-red-300 text-red-600 hover:bg-red-50"
                : "border border-green-300 text-green-600 hover:bg-green-50"
            }`}
          >
            {client.is_active ? (
              <>
                <UserX className="h-4 w-4" />
                Деактивировать
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4" />
                Активировать
              </>
            )}
          </button>
        </div>
      </div>

      {/* --- Вкладки --- */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* --- Содержимое вкладки --- */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        {activeTab === "info" && <InfoTab client={client} />}
        {activeTab === "subscriptions" && <SubscriptionsTab clientId={clientId} />}
        {activeTab === "payments" && <PaymentsTab clientId={clientId} />}
        {activeTab === "visits" && <VisitsTab clientId={clientId} />}
        {activeTab === "workouts" && <WorkoutsTab clientId={clientId} />}
        {activeTab === "notes" && <NotesTab client={client} />}
      </div>

      {/* --- Диалог подтверждения деактивации --- */}
      <ConfirmDialog
        isOpen={showDeactivateDialog}
        title={client.is_active ? "Деактивировать клиента?" : "Активировать клиента?"}
        message={
          client.is_active
            ? `Клиент "${formatFullName(client.last_name, client.first_name, client.middle_name)}" будет деактивирован. Данные сохранятся.`
            : `Клиент "${formatFullName(client.last_name, client.first_name, client.middle_name)}" будет активирован.`
        }
        confirmText={client.is_active ? "Деактивировать" : "Активировать"}
        isDanger={client.is_active}
        onConfirm={handleToggleActive}
        onCancel={() => setShowDeactivateDialog(false)}
      />
    </div>
  );
}

// === Вкладка "Информация" ===

function InfoTab({ client }: { readonly client: Client }) {
  return (
    <div className="space-y-4">
      <InfoRow
        icon={<Phone className="h-4 w-4" />}
        label="Телефон"
        value={formatPhone(client.phone)}
      />
      <InfoRow
        icon={<Calendar className="h-4 w-4" />}
        label="Дата рождения"
        value={formatDate(client.birth_date)}
      />
      <InfoRow
        icon={<UserIcon className="h-4 w-4" />}
        label="Тренер"
        value={client.trainer_name ?? "Не назначен"}
      />
      <InfoRow
        icon={<Calendar className="h-4 w-4" />}
        label="Дата регистрации"
        value={formatDate(client.created_at)}
      />
    </div>
  );
}

// === Вкладка "Заметки" ===

function NotesTab({ client }: { readonly client: Client }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Stethoscope className="h-4 w-4" />
          Медицинские ограничения
        </div>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {client.medical_notes || "Не указаны"}
        </p>
      </div>
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
          <StickyNote className="h-4 w-4" />
          Заметки
        </div>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {client.notes || "Нет заметок"}
        </p>
      </div>
    </div>
  );
}

// === Строка информации ===

function InfoRow({
  icon,
  label,
  value,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
      <span className="text-slate-400">{icon}</span>
      <span className="w-40 text-sm font-medium text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  );
}