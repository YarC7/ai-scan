"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  normalizeUsername,
  usernameToEmail,
  validateUsername,
} from "@/lib/username";

const INPUT =
  "min-h-[52px] w-full rounded-2xl border border-(--border) bg-(--bg) px-4 text-[17px] text-(--text-h) outline-none focus:border-(--accent-border)";

export default function NewEmployeePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const { error: apiError } = await authClient.admin.createUser({
      name: name.trim(),
      email: usernameToEmail(normalizedUsername),
      password,
      role: "employee",
    });

    setLoading(false);

    if (apiError) {
      if (apiError.status === 422) {
        setError("This username is already taken.");
      } else {
        setError(apiError.message || "Could not create the employee account.");
      }
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-(--text)"
      >
        <ArrowLeft size={16} />
        Employee list
      </Link>

      <h2 className="text-xl font-semibold tracking-tight text-(--text-h)">
        Add employee
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-semibold text-(--text-h)">
            Employee name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="John Doe"
            className={INPUT}
          />
        </div>

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
            autoComplete="off"
            required
            minLength={3}
            maxLength={30}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="nhanvien"
            className={INPUT}
          />
          <p className="text-[12px] text-(--text)">
            3-30 characters: letters, numbers, dots or underscores.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-(--text-h)">
            Initial password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            className={INPUT}
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-(--accent-border) bg-(--accent-soft) text-[17px] font-semibold text-(--accent-ink) transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] enabled:hover:border-(--accent) enabled:hover:bg-(--accent-soft-hover) active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-none"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
