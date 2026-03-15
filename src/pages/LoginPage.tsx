// src/pages/LoginPage.tsx
//
// Экран входа в приложение.
// Показывается при запуске, если пользователь не авторизован.

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dumbbell, Eye, EyeOff, LogIn, KeyRound } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { getLogoBase64, recoverAdminPassword } from "../lib/tauri";
import {
  loginSchema,
  changePasswordSchema,
  type LoginFormData,
  type ChangePasswordFormData,
} from "../lib/validators";

/** Форма входа — вынесена для снижения Cognitive Complexity */
function LoginForm({
  onSubmit,
  isLoading,
}: {
  readonly onSubmit: (data: LoginFormData) => void;
  readonly isLoading: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
          Логин
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-5 py-3.5 text-lg text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Введите логин"
          {...form.register("username")}
        />
        {form.formState.errors.username && (
          <p className="mt-1 text-sm text-red-500">{form.formState.errors.username.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Пароль
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 px-5 py-3.5 pr-12 text-lg text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Введите пароль"
            {...form.register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {form.formState.errors.password && (
          <p className="mt-1 text-sm text-red-500">{form.formState.errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3.5 text-lg font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogIn className="h-5 w-5" />
        {isLoading ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}

/** Форма смены пароля — вынесена для снижения Cognitive Complexity */
function ChangePasswordForm({
  onSubmit,
  isLoading,
}: {
  readonly onSubmit: (data: ChangePasswordFormData) => void;
  readonly isLoading: boolean;
}) {
  const [showPasswords, setShowPasswords] = useState(false);

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { old_password: "", new_password: "", confirm_password: "" },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label htmlFor="old_password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Текущий пароль
        </label>
        <input
          id="old_password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-300 px-5 py-3.5 text-lg text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Введите текущий пароль"
          {...form.register("old_password")}
        />
        {form.formState.errors.old_password && (
          <p className="mt-1 text-sm text-red-500">{form.formState.errors.old_password.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="new_password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Новый пароль
        </label>
        <div className="relative">
          <input
            id="new_password"
            type={showPasswords ? "text" : "password"}
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 px-5 py-3.5 pr-12 text-lg text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Минимум 4 символа"
            {...form.register("new_password")}
          />
          <button
            type="button"
            onClick={() => setShowPasswords((prev) => !prev)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={showPasswords ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPasswords ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {form.formState.errors.new_password && (
          <p className="mt-1 text-sm text-red-500">{form.formState.errors.new_password.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirm_password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Подтвердите пароль
        </label>
        <input
          id="confirm_password"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          className="w-full rounded-lg border border-slate-300 px-5 py-3.5 text-lg text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Повторите новый пароль"
          {...form.register("confirm_password")}
        />
        {form.formState.errors.confirm_password && (
          <p className="mt-1 text-sm text-red-500">{form.formState.errors.confirm_password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3.5 text-lg font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <KeyRound className="h-5 w-5" />
        {isLoading ? "Сохранение..." : "Сменить пароль"}
      </button>
    </form>
  );
}

/** Форма восстановления пароля по мастер-ключу */
function RecoveryForm({
  onBack,
}: {
  readonly onBack: () => void;
}) {
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleRecover = async () => {
    if (!recoveryKey.trim()) {
      setMessage({ type: "error", text: "Введите мастер-ключ" });
      return;
    }
    if (newPassword.length < 4) {
      setMessage({ type: "error", text: "Пароль минимум 4 символа" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Пароли не совпадают" });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    try {
      await recoverAdminPassword(recoveryKey.trim(), newPassword);
      setMessage({ type: "success", text: "Пароль сброшен! Войдите с новым паролем." });
    } catch (err) {
      const text = typeof err === "string" ? err : "Ошибка восстановления";
      setMessage({ type: "error", text });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-center text-lg font-semibold text-slate-900">Восстановление пароля</h2>
      <p className="text-center text-sm text-slate-500">
        Введите мастер-ключ, который был показан при первом запуске
      </p>

      {message && (
        <div className={`rounded-lg p-3 text-center text-sm ${
          message.type === "success" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
        }`}>
          {message.text}
        </div>
      )}

      <div>
        <label htmlFor="recovery-key" className="mb-1.5 block text-sm font-medium text-slate-700">
          Мастер-ключ
        </label>
        <input
          id="recovery-key"
          type="text"
          value={recoveryKey}
          onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
          placeholder="XXXXXXXX"
          className="w-full rounded-lg border border-slate-300 px-5 py-3.5 text-center text-xl font-mono tracking-widest text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div>
        <label htmlFor="new-pass" className="mb-1.5 block text-sm font-medium text-slate-700">
          Новый пароль
        </label>
        <input
          id="new-pass"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Минимум 4 символа"
          className="w-full rounded-lg border border-slate-300 px-5 py-3.5 text-lg text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div>
        <label htmlFor="confirm-pass" className="mb-1.5 block text-sm font-medium text-slate-700">
          Подтвердите пароль
        </label>
        <input
          id="confirm-pass"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Повторите пароль"
          className="w-full rounded-lg border border-slate-300 px-5 py-3.5 text-lg text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <button
        type="button"
        onClick={handleRecover}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3.5 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        <KeyRound className="h-5 w-5" />
        {isLoading ? "Восстановление..." : "Сбросить пароль"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-sm text-blue-600 transition hover:text-blue-800"
      >
        Вернуться к входу
      </button>
    </div>
  );
}

export default function LoginPage() {
  const { user, isLoading, error, performLogin, performChangePassword, clearError } =
    useAuthStore();

  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    getLogoBase64().then((data) => {
      if (data) setLogoSrc(data);
    }).catch(() => {});
  }, []);

  const handleLogin = (data: LoginFormData) => {
    clearError();
    performLogin(data.username, data.password);
  };

  const handleChangePassword = (data: ChangePasswordFormData) => {
    clearError();
    performChangePassword(data.old_password, data.new_password);
  };

  const showChangePassword = user?.force_password_change ?? false;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-12 shadow-2xl">
        {/* --- Заголовок с логотипом --- */}
        <div className="mb-10 text-center">
          {logoSrc ? (
            <img src={logoSrc} alt="Логотип" className="mx-auto mb-5 h-24 w-24 rounded-full object-cover" />
          ) : (
            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-slate-900">
              <Dumbbell className="h-12 w-12 text-blue-400" />
            </div>
          )}
          <h1 className="text-3xl font-bold text-slate-900">Чемпион</h1>
          <p className="mt-1 text-base text-slate-500">
            {showChangePassword ? "Необходимо сменить пароль" : "Система учёта клиентов"}
          </p>
        </div>

        {/* --- Сообщение об ошибке --- */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {/* --- Форма --- */}
        {showRecovery ? (
          <RecoveryForm onBack={() => setShowRecovery(false)} />
        ) : showChangePassword ? (
          <ChangePasswordForm onSubmit={handleChangePassword} isLoading={isLoading} />
        ) : (
          <>
            <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              className="mt-4 w-full text-center text-sm text-slate-400 transition hover:text-blue-600"
            >
              Забыли пароль?
            </button>
          </>
        )}

        {/* --- Подпись внизу --- */}
        <p className="mt-8 text-center text-xs text-slate-400">
          GymChampion v0.1.0
        </p>
      </div>
    </div>
  );
}