// src/App.tsx
//
// Главный компонент приложения.
// Роутинг через состояние currentPage + selectedClientId.

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuthStore } from "./store/authStore";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import ClientsPage from "./pages/ClientsPage";
import ClientFormPage from "./pages/ClientFormPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import VisitsPage from "./pages/VisitsPage";
import DashboardPage from "./pages/DashboardPage";
import NotificationToast from "./components/NotificationToast";
import PaymentsPage from "./pages/PaymentsPage";
import SettingsPage from "./pages/SettingsPage";
import ImportPage from "./pages/ImportPage";
import ReportsPage from "./pages/ReportsPage";
import { generateRecoveryKey } from "./lib/tauri";
import { useUIStore } from "./store/uiStore";
function PlaceholderPage({ title }: { readonly title: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-700">{title}</h2>
        <p className="mt-2 text-slate-400">Раздел в разработке</p>
      </div>
    </div>
  );
}

export default function App() {
  const user = useAuthStore((state) => state.user);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const handleNavigate = useCallback((page: string, clientId?: number) => {
    setCurrentPage(page);
    setSelectedClientId(clientId ?? null);
  }, []);

  const addNotification = useUIStore((state) => state.addNotification);

  // --- Автоблокировка по таймауту (15 минут) ---
  const TIMEOUT_MS = 15 * 60 * 1000; // 15 минут
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const logout = useAuthStore((state) => state.logout);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Запускаем таймер только если пользователь авторизован
    if (user) {
      timeoutRef.current = setTimeout(() => {
        logout();
      }, TIMEOUT_MS);
    }
  }, [user, logout]);

  // Слушаем активность пользователя
  useEffect(() => {
    if (!user) return;

    const events = ["mousedown", "keydown", "mousemove", "touchstart", "scroll"];

    const handleActivity = () => resetTimer();

    for (const event of events) {
      window.addEventListener(event, handleActivity);
    }

    // Запускаем таймер при монтировании
    resetTimer();

    return () => {
      for (const event of events) {
        window.removeEventListener(event, handleActivity);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, resetTimer]);

  // --- Мастер-ключ восстановления (показывается один раз) ---
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  useEffect(() => {
    if (user && !user.force_password_change) {
      generateRecoveryKey().then((key) => {
        console.log("Recovery key result:", key);
        if (key) setRecoveryKey(key);
      }).catch((err) => {
        console.error("Recovery key error:", err);
      });
    }
  }, [user]);

  if (!user || user.force_password_change) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage onNavigate={handleNavigate} />;
      case "clients":
        return <ClientsPage onNavigate={handleNavigate} />;
      case "client-form":
        return (
          <ClientFormPage
            clientId={selectedClientId}
            onNavigate={handleNavigate}
          />
        );
      case "client-detail":
        return selectedClientId ? (
          <ClientDetailPage
            clientId={selectedClientId}
            onNavigate={handleNavigate}
          />
        ) : (
          <PlaceholderPage title="Клиент не выбран" />
        );
      case "visits":
        return <VisitsPage />;
      case "payments":
        return <PaymentsPage />;
      case "reports":
        return <ReportsPage />;
      case "import":
        return <ImportPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={handleNavigate} />;

    }
  };

  const activeMenuItem = currentPage.startsWith("client") ? "clients" : currentPage;

  return (
    <>
    {/* Модалка с мастер-ключом (показывается один раз) */}
      {recoveryKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
            <h2 className="mb-2 text-center text-lg font-bold text-slate-900">Мастер-ключ восстановления</h2>
            <p className="mb-4 text-center text-sm text-slate-500">
              Запишите этот ключ и храните в безопасном месте. Он понадобится если вы забудете пароль. Ключ показывается только один раз.
            </p>
            <div className="mb-6 rounded-lg bg-slate-100 p-4 text-center">
              <p className="font-mono text-2xl font-bold tracking-widest text-slate-900">{recoveryKey}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { save } = await import("@tauri-apps/plugin-dialog");
                    const path = await save({
                      defaultPath: "gym_champion_recovery_key.txt",
                      filters: [{ name: "Текст", extensions: ["txt"] }],
                    });
                    if (path) {
                      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
                      await writeTextFile(path, `GymChampion — Мастер-ключ восстановления\n\nКлюч: ${recoveryKey}\n\nХраните этот файл в безопасном месте (на флешке, в сейфе).\nЕсли забудете пароль — используйте этот ключ для сброса.\n`);
                      addNotification("success", "Ключ сохранён в файл");
                    }
                  } catch {
                    addNotification("error", "Ошибка сохранения файла");
                  }
                }}
                className="flex-1 rounded-lg border border-blue-600 px-4 py-3 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
              >
                Сохранить в файл
              </button>
              <button
                type="button"
                onClick={() => setRecoveryKey(null)}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Я записал ключ
              </button>
            </div>
          </div>
        </div>
      )}
      <NotificationToast />
      <Layout currentPage={activeMenuItem} onNavigate={handleNavigate}>
        {renderPage()}
      </Layout>
    </>
  );
}