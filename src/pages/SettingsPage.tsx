// src/pages/SettingsPage.tsx
//
// Страница настроек: управление типами абонементов и пользователями.
// Доступна только администратору.

import { useEffect, useState } from "react";
import { Plus, Save, UserPlus, Shield, Dumbbell, HardDriveDownload, HardDriveUpload, Upload } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  getSubscriptionTypes,
  createSubscriptionType,
  updateSubscriptionType,
  toggleSubscriptionTypeActive,
  getUsers,
  createUser,
  toggleUserActive,
  resetUserPassword,
  getDbInfo,
  createBackup,
  restoreBackup,
  getLogoBase64,
  uploadLogo,
} from "../lib/tauri";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import ConfirmDialog from "../components/ConfirmDialog";
import type { SubscriptionType, User } from "../types";

/** Вкладки настроек */
const TABS = [
  { id: "subscriptions", label: "Типы абонементов" },
  { id: "users", label: "Пользователи" },
  { id: "backup", label: "Бэкап" },
  { id: "about", label: "О приложении" },
] as const;

type SettingsTab = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("subscriptions");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Настройки</h1>

      {/* Вкладки */}
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

      <div className="rounded-lg bg-white p-6 shadow-sm">
        {activeTab === "subscriptions" && <SubscriptionTypesTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "backup" && <BackupTab />}
        {activeTab === "about" && <AboutTab />}
      </div>
    </div>
  );
}

// === Вкладка "Типы абонементов" ===

function SubscriptionTypesTab() {
  const addNotification = useUIStore((state) => state.addNotification);

  const [types, setTypes] = useState<readonly SubscriptionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Форма (создание и редактирование)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTypes = async () => {
    setIsLoading(true);
    try {
      const data = await getSubscriptionTypes(true);
      setTypes(data);
    } catch {
      addNotification("error", "Ошибка загрузки типов");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, []);

  // Открыть форму для создания
  const handleNewType = () => {
    setEditingId(null);
    setName("");
    setDurationDays("");
    setPrice("");
    setShowForm(true);
  };

  // Открыть форму для редактирования
  const handleEditType = (type: SubscriptionType) => {
    setEditingId(type.id);
    setName(type.name);
    setDurationDays(type.duration_days ? String(type.duration_days) : "");
    setPrice(String(type.price));
    setShowForm(true);
  };

  // Сохранить (создание или обновление)
  const handleSave = async () => {
    if (!name.trim()) {
      addNotification("warning", "Введите название");
      return;
    }
    const parsedPrice = Number.parseFloat(price);
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      addNotification("warning", "Введите корректную цену");
      return;
    }

    setIsSubmitting(true);
    try {
      const days = durationDays ? Number.parseInt(durationDays, 10) : null;
      const data = { name: name.trim(), duration_days: days, price: parsedPrice };

      if (editingId) {
        await updateSubscriptionType(editingId, data);
        addNotification("success", "Тип абонемента обновлён");
      } else {
        await createSubscriptionType(data);
        addNotification("success", "Тип абонемента создан");
      }

      setShowForm(false);
      setEditingId(null);
      setName("");
      setDurationDays("");
      setPrice("");
      await loadTypes();
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка сохранения";
      addNotification("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Включить/выключить тип
  const handleToggle = async (typeId: number) => {
    try {
      await toggleSubscriptionTypeActive(typeId);
      addNotification("success", "Статус изменён");
      await loadTypes();
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка";
      addNotification("error", message);
    }
  };

  // Отмена редактирования
  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setDurationDays("");
    setPrice("");
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNewType}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Новый тип
        </button>
      </div>

      {/* Форма создания/редактирования */}
      {showForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">
            {editingId ? "Редактирование типа" : "Новый тип абонемента"}
          </h4>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label htmlFor="type-name" className="mb-1 block text-xs font-medium text-slate-600">
                Название
              </label>
              <input
                id="type-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Месяц, Квартал..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label htmlFor="type-days" className="mb-1 block text-xs font-medium text-slate-600">
                Дней
              </label>
              <input
                id="type-days"
                type="number"
                min="1"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="30"
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label htmlFor="type-price" className="mb-1 block text-xs font-medium text-slate-600">
                Цена (BYN)
              </label>
              <input
                id="type-price"
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="50.00"
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? "Сохранение..." : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Таблица типов */}
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Название</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Дней</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Цена</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Статус</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {types.map((type) => (
              <tr key={type.id} className={type.is_active ? "" : "opacity-50"}>
                <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{type.name}</td>
                <td className="px-4 py-2.5 text-sm text-slate-600">{type.duration_days ?? "—"}</td>
                <td className="px-4 py-2.5 text-sm text-slate-600">{type.price.toFixed(2)} BYN</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium ${type.is_active ? "text-green-600" : "text-red-500"}`}>
                    {type.is_active ? "Активен" : "Отключён"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditType(type)}
                      className="rounded px-2 py-1 text-xs text-blue-600 transition hover:bg-blue-50"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(type.id)}
                      className={`rounded px-2 py-1 text-xs transition ${
                        type.is_active
                          ? "text-red-500 hover:bg-red-50"
                          : "text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {type.is_active ? "Отключить" : "Включить"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Вкладка "Пользователи" ===

function UsersTab() {
  const currentUser = useAuthStore((state) => state.user);
  const addNotification = useUIStore((state) => state.addNotification);

  const [users, setUsers] = useState<readonly User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    userId: number;
    type: "toggle" | "reset";
    userName: string;
  } | null>(null);

  // Форма нового пользователя
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"trainer" | "admin">("trainer");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      addNotification("error", "Ошибка загрузки пользователей");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!username.trim() || !fullName.trim() || password.length < 4) {
      addNotification("warning", "Заполните все поля (пароль мин. 4 символа)");
      return;
    }

    setIsSubmitting(true);
    try {
      await createUser({
        username: username.trim(),
        password,
        full_name: fullName.trim(),
        role,
      });
      addNotification("success", "Пользователь создан");
      setShowForm(false);
      setUsername("");
      setPassword("");
      setFullName("");
      setRole("trainer");
      await loadUsers();
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка создания";
      addNotification("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || !currentUser) return;

    try {
      if (confirmAction.type === "toggle") {
        await toggleUserActive(confirmAction.userId, currentUser.id);
        addNotification("success", "Статус пользователя изменён");
      } else {
        await resetUserPassword(confirmAction.userId, "1234");
        addNotification("success", "Пароль сброшен на '1234'");
      }
      await loadUsers();
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка";
      addNotification("error", message);
    } finally {
      setConfirmAction(null);
    }
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
          <UserPlus className="h-4 w-4" />
          Новый пользователь
        </button>
      </div>

      {/* Форма создания */}
      {showForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Новый пользователь</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="user-fullname" className="mb-1 block text-xs font-medium text-slate-600">ФИО</label>
              <input
                id="user-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label htmlFor="user-login" className="mb-1 block text-xs font-medium text-slate-600">Логин</label>
              <input
                id="user-login"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ivanov"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label htmlFor="user-pass" className="mb-1 block text-xs font-medium text-slate-600">Пароль</label>
              <input
                id="user-pass"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Мин. 4 символа"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label htmlFor="user-role" className="mb-1 block text-xs font-medium text-slate-600">Роль</label>
              <select
                id="user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "trainer" | "admin")}
                aria-label="Роль пользователя"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="trainer">Тренер</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleCreateUser}
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? "Создание..." : "Создать"}
            </button>
          </div>
        </div>
      )}

      {/* Список пользователей */}
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                user.role === "admin" ? "bg-purple-100" : "bg-blue-100"
              }`}>
                {user.role === "admin"
                  ? <Shield className="h-4 w-4 text-purple-600" />
                  : <Dumbbell className="h-4 w-4 text-blue-600" />
                }
              </div>
              <div>
                <p className={`text-sm font-medium ${user.is_active ? "text-slate-900" : "text-slate-400"}`}>
                  {user.full_name}
                </p>
                <p className="text-xs text-slate-500">
                  @{user.username} · {user.role === "admin" ? "Администратор" : "Тренер"}
                </p>
              </div>
            </div>
            {/* Не показываем действия для текущего пользователя */}
            {user.id !== currentUser?.id && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction({ userId: user.id, type: "reset", userName: user.full_name })}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Сбросить пароль
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction({ userId: user.id, type: "toggle", userName: user.full_name })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    user.is_active
                      ? "border border-red-300 text-red-600 hover:bg-red-50"
                      : "border border-green-300 text-green-600 hover:bg-green-50"
                  }`}
                >
                  {user.is_active ? "Заблокировать" : "Разблокировать"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Диалог подтверждения */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={confirmAction?.type === "toggle" ? "Изменить статус?" : "Сбросить пароль?"}
        message={
          confirmAction?.type === "toggle"
            ? `Изменить статус пользователя "${confirmAction.userName}"?`
            : `Пароль пользователя "${confirmAction?.userName}" будет сброшен на "1234". При следующем входе потребуется сменить пароль.`
        }
        confirmText={confirmAction?.type === "toggle" ? "Изменить" : "Сбросить"}
        isDanger={confirmAction?.type === "toggle"}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

// === Вкладка "Бэкап" ===

function BackupTab() {
  const addNotification = useUIStore((state) => state.addNotification);

  const [dbInfo, setDbInfo] = useState<import("../lib/tauri").DbInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getDbInfo()
      .then(setDbInfo)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleCreateBackup = async () => {
    try {
      const dir = await openDialog({
        directory: true,
        title: "Выберите папку для бэкапа",
      });
      if (!dir || typeof dir !== "string") return;
      const result = await createBackup(dir);
      addNotification("success", result);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка создания бэкапа";
      addNotification("error", message);
    }
  };

  const handleRestore = async () => {
    try {
      const file = await openDialog({
        multiple: false,
        title: "Выберите файл бэкапа",
        filters: [{ name: "Database", extensions: ["db"] }],
      });
      if (!file || typeof file !== "string") return;
      const result = await restoreBackup(file);
      addNotification("warning", result);
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка восстановления";
      addNotification("error", message);
    }
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Информация о БД */}
      {dbInfo && (
        <div className="rounded-lg bg-slate-50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-700">База данных</h4>
          <p className="text-sm text-slate-600">Путь: {dbInfo.path}</p>
          <p className="text-sm text-slate-600">Размер: {dbInfo.size_display}</p>
        </div>
      )}

      {/* Кнопки */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCreateBackup}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <HardDriveDownload className="h-4 w-4" />
          Создать бэкап
        </button>
        <button
          type="button"
          onClick={handleRestore}
          className="flex items-center gap-2 rounded-lg border border-amber-300 px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
        >
          <HardDriveUpload className="h-4 w-4" />
          Восстановить из бэкапа
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Бэкап сохраняет копию базы данных. Можно сохранить на флешку или в другую папку.
        При восстановлении текущая база заменяется файлом из бэкапа — приложение нужно перезапустить.
      </p>
    </div>
  );
}

// === Вкладка "О приложении" ===

function AboutTab() {
  const addNotification = useUIStore((state) => state.addNotification);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    getLogoBase64().then((data) => {
      if (data) setLogoSrc(data);
    }).catch(() => {});
  }, []);

  const handleUploadLogo = async () => {
    try {
      const file = await openDialog({
        multiple: false,
        title: "Выберите логотип",
        filters: [{ name: "Изображения", extensions: ["png", "jpg", "jpeg", "svg"] }],
      });
      if (!file || typeof file !== "string") return;

      await uploadLogo(file);
      // Перезагружаем логотип
      const newData = await getLogoBase64();
      if (newData) setLogoSrc(newData);
      addNotification("success", "Логотип обновлён");
    } catch (err) {
      const message = typeof err === "string" ? err : "Ошибка загрузки логотипа";
      addNotification("error", message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {logoSrc ? (
          <img src={logoSrc} alt="Логотип" className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900">
            <Dumbbell className="h-8 w-8 text-blue-400" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-slate-900">GymChampion</h2>
          <p className="text-sm text-slate-500">Система учёта клиентов тренажёрного зала</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleUploadLogo}
        className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <Upload className="h-4 w-4" />
        Загрузить логотип
      </button>

      <div className="space-y-2 text-sm text-slate-600">
        <p>Версия: 0.1.0</p>
        <p>Тренажёрный зал «Чемпион», Гродно</p>
        <p>Разработчик: Andrey</p>
      </div>
    </div>
  );
}
