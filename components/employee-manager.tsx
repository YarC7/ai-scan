"use client";

import { useState } from "react";
import { ChevronDown, KeyRound, Loader2, Search, UserCheck, UserPlus, UserX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export type Employee = {
  id: string;
  name: string;
  username: string;
  banned: boolean;
  createdAt: string | Date | null;
};

const ACTION_BTN =
  "inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-none";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

export function EmployeeManager({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...employees].sort((a, b) => {
    if (a.banned !== b.banned) return a.banned ? 1 : -1;
    return a.name.localeCompare(b.name, "en");
  });

  const query = normalize(search.trim());
  const filtered = query
    ? sorted.filter(
        (employee) =>
          normalize(employee.name).includes(query) ||
          normalize(employee.username).includes(query),
      )
    : sorted;

  const activeCount = employees.filter((employee) => !employee.banned).length;

  function flash(message: string) {
    setNotice(message);
    setError(null);
    window.setTimeout(() => setNotice(null), 3000);
  }

  async function toggleBan(employee: Employee) {
    if (employee.banned) {
      setNotice(null);
      setError(null);
      setBusyId(employee.id);
      const { error: apiError } = await authClient.admin.unbanUser({
        userId: employee.id,
      });
      setBusyId(null);
      if (apiError) {
        setError(apiError.message || "Could not reactivate the account.");
        return;
      }
      flash(`Reactivated ${employee.name}.`);
      router.refresh();
      return;
    }

    const confirmed = window.confirm(
      `Disable ${employee.name}'s account? They will be signed out and unable to scan labels.`,
    );
    if (!confirmed) return;

    setNotice(null);
    setError(null);
    setBusyId(employee.id);
    const { error: apiError } = await authClient.admin.banUser({
      userId: employee.id,
      banReason: "No longer employed",
    });
    setBusyId(null);
    if (apiError) {
      setError(apiError.message || "Could not disable the account.");
      return;
    }
    flash(`Disabled ${employee.name}.`);
    router.refresh();
  }

  async function submitReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetTarget || resetting) return;

    if (newPassword.length < 8) {
      setError("The new password must be at least 8 characters.");
      return;
    }

    setResetting(true);
    const { error: apiError } = await authClient.admin.setUserPassword({
      userId: resetTarget.id,
      newPassword,
    });
    setResetting(false);

    if (apiError) {
      setError(apiError.message || "Could not reset the password.");
      return;
    }

    flash(`Reset the password for ${resetTarget.name}.`);
    setResetTarget(null);
    setNewPassword("");
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-(--text)">
          {query ? `${filtered.length} of ${employees.length}` : employees.length}{" "}
          {employees.length === 1 ? "employee" : "employees"} · {activeCount} active
        </p>
        <Link
          href="/admin/users/new"
          aria-label="Add employee"
          className="inline-flex min-h-[44px] flex-none items-center justify-center gap-1.5 rounded-xl border border-(--accent-border) bg-(--accent-soft) px-4 text-sm font-semibold text-(--accent-ink) transition-[background-color,border-color,transform] duration-150 hover:border-(--accent) hover:bg-(--accent-soft-hover) active:scale-[0.97]"
        >
          <UserPlus size={16} />
          Add
        </Link>
      </div>

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--text)"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSearch("");
          }}
          placeholder="Search employees"
          aria-label="Search employees by name or username"
          className="h-12 w-full rounded-2xl border border-(--border) bg-(--bg) pl-11 pr-11 text-[16px] text-(--text-h) outline-none transition-colors placeholder:text-(--text) focus:border-(--accent-border) [&::-webkit-search-cancel-button]:hidden"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-(--text) transition-colors hover:bg-(--code-bg) hover:text-(--text-h)"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {notice ? (
        <p className="rounded-xl border border-(--accent-border) bg-(--accent-bg) px-3 py-2.5 text-sm font-medium text-(--accent-ink)">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--border) px-4 py-8 text-center text-sm text-(--text)">
          No employees yet. Tap “Add” to create the first account.
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-(--border) px-4 py-8 text-center">
          <p className="text-sm text-(--text)">No employees match “{search.trim()}”.</p>
          <button
            type="button"
            onClick={() => setSearch("")}
            className="mt-2 cursor-pointer text-sm font-semibold text-(--accent) hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((employee) => {
            const busy = busyId === employee.id;
            const expanded = expandedId === employee.id;
            return (
              <li
                key={employee.id}
                className={`overflow-hidden rounded-[18px] border bg-(--bg) shadow-[0_10px_24px_-20px_rgba(8,6,13,0.35)] transition-colors ${
                  expanded ? "border-(--accent-border)" : "border-(--border)"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : employee.id)}
                  aria-expanded={expanded}
                  className="flex w-full cursor-pointer items-center gap-3 p-3.5 text-left transition-colors hover:bg-(--code-bg) focus-visible:bg-(--code-bg) focus-visible:outline-none"
                >
                  <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-(--text-h)">
                    {employee.name}
                    <span className="ml-2 text-[13px] font-normal text-(--text)">
                      @{employee.username}
                    </span>
                  </p>
                  {employee.banned ? (
                    <span className="flex-none rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                      Disabled
                    </span>
                  ) : null}
                  <ChevronDown
                    size={18}
                    className={`flex-none text-(--text) transition-transform duration-200 ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expanded ? (
                  <div className="border-t border-(--border) px-3.5 pb-3.5 pt-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleBan(employee)}
                        className={`${ACTION_BTN} ${
                          employee.banned
                            ? "border-(--accent-border) bg-(--accent-bg) text-(--accent-ink) enabled:hover:bg-(--accent-soft)"
                            : "border-(--border) bg-transparent text-(--text-h) enabled:hover:border-red-300 enabled:hover:bg-red-500/10 enabled:hover:text-red-600"
                        }`}
                      >
                        {busy ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : employee.banned ? (
                          <UserCheck size={16} />
                        ) : (
                          <UserX size={16} />
                        )}
                        {employee.banned ? "Reactivate" : "Disable"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setNewPassword("");
                          setResetTarget(employee);
                        }}
                        className={`${ACTION_BTN} border-(--border) bg-transparent text-(--text-h) enabled:hover:border-(--accent-border) enabled:hover:bg-(--accent-bg)`}
                      >
                        <KeyRound size={16} />
                        Password
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {resetTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] sm:items-center sm:pb-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Reset password for ${resetTarget.name}`}
        >
          <form
            onSubmit={submitReset}
            className="w-full max-w-[400px] rounded-[22px] border border-(--border) bg-(--bg) p-5 shadow-[0_24px_60px_-24px_rgba(8,6,13,0.5)]"
          >
            <h2 className="text-lg font-semibold text-(--text-h)">Reset password</h2>
            <p className="mt-1 text-sm text-(--text)">
              Enter a new password for {resetTarget.name} ({resetTarget.username}).
            </p>
            <input
              type="password"
              autoFocus
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="At least 8 characters"
              className="mt-3 min-h-[52px] w-full rounded-2xl border border-(--border) bg-(--bg) px-4 text-[17px] text-(--text-h) outline-none focus:border-(--accent-border)"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setNewPassword("");
                }}
                className="inline-flex min-h-[48px] flex-1 cursor-pointer items-center justify-center rounded-xl border border-(--border) bg-transparent text-[15px] font-semibold text-(--text-h) transition-colors duration-150 hover:bg-(--code-bg) active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetting}
                className="inline-flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-(--accent-border) bg-(--accent-soft) text-[15px] font-semibold text-(--accent-ink) transition-[background-color,border-color,transform] duration-150 enabled:hover:border-(--accent) enabled:hover:bg-(--accent-soft-hover) active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resetting ? <Loader2 size={16} className="animate-spin" /> : null}
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
