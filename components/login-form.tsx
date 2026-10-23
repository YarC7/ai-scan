"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { normalizeUsername, usernameToEmail, validateUsername } from "@/lib/username";

const BTN =
  "inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-none";

function redirectPath(role: string | null | undefined): string {
  return role === "owner" ? "/admin" : "/";
}

export function LoginForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) {
        router.replace(redirectPath((data.user as { role?: string }).role));
      }
    });
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError(null);

    const normalizedUsername = normalizeUsername(username);
    const usernameError = validateUsername(normalizedUsername);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    setLoading(true);

    const { error: signInError } = await authClient.signIn.email({
      email: usernameToEmail(normalizedUsername),
      password,
      rememberMe: true,
    });

    if (signInError) {
      setLoading(false);
      if (signInError.status === 403) {
        setError(
          signInError.message ||
            "Your account has been disabled. Contact the store owner.",
        );
      } else if (signInError.status === 429) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else {
        setError("Incorrect username or password.");
      }
      return;
    }

    const { data } = await authClient.getSession();
    router.replace(redirectPath((data?.user as { role?: string } | undefined)?.role));
    router.refresh();
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-7 flex flex-col items-center text-center">
        <img
          src="/icon.png"
          alt="TeaZenTea"
          className="size-16 rounded-full object-cover shadow-[0_12px_28px_-12px_rgba(8,6,13,0.45)]"
        />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-(--text-h)">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-(--text)">AI Scan · TeaZenTea</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-sm font-semibold text-(--text-h)">
            Username
          </label>
          <input
            id="username"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="username"
            className="min-h-[52px] w-full rounded-2xl border border-(--border) bg-(--bg) px-4 text-[17px] text-(--text-h) outline-none focus:border-(--accent-border)"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-(--text-h)">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="min-h-[52px] w-full rounded-2xl border border-(--border) bg-(--bg) px-4 pr-12 text-[17px] text-(--text-h) outline-none focus:border-(--accent-border)"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-(--text)"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={`${BTN} mt-1 cursor-pointer border border-(--accent-border) bg-(--accent-soft) text-(--accent-ink) transition-[transform,background-color,border-color] duration-200 enabled:hover:border-(--accent) enabled:hover:bg-(--accent-soft-hover)`}
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : null}
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-(--text)">
        Don&apos;t have an account? Contact the store owner to get one.
      </p>
    </div>
  );
}
