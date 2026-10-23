"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Plus, Trash2, Wifi } from "lucide-react";
import type { AllowedIp } from "@/lib/allowlist";
import {
  createAllowedIp,
  removeAllowedIp,
} from "@/app/(admin)/admin/network/actions";

const INPUT =
  "min-h-[52px] w-full rounded-2xl border border-(--border) bg-(--bg) px-4 text-[17px] text-(--text-h) outline-none focus:border-(--accent-border)";

export function AllowlistManager({
  rules,
  currentIp,
  currentIpIsPrivate,
  currentIpIsLoopback,
}: {
  rules: AllowedIp[];
  currentIp: string | null;
  currentIpIsPrivate: boolean;
  currentIpIsLoopback: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await createAllowedIp(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      setNotice("IP address added.");
    });
  }

  function addCurrentIp() {
    if (!currentIp || pending) return;

    const formData = new FormData();
    formData.set("value", currentIp);
    formData.set("label", "Current IP");

    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await createAllowedIp(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(`Added the current IP (${currentIp}).`);
    });
  }

  function remove(rule: AllowedIp) {
    const confirmed = window.confirm(
      `Remove ${rule.value} from the list? Devices using this IP will no longer be able to scan.`,
    );
    if (!confirmed) return;

    setError(null);
    setNotice(null);
    setBusyId(rule.id);
    startTransition(async () => {
      const result = await removeAllowedIp(rule.id);
      setBusyId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice("IP address removed.");
    });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-2xl border border-(--border) bg-(--accent-bg) px-4 py-3.5 text-sm text-(--text)">
        <div className="flex items-center gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-full bg-(--bg) text-(--accent)">
            <Wifi size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-(--text) uppercase">
              Current IP
            </p>
            <p className="truncate font-mono text-[15px] font-semibold text-(--text-h)">
              {currentIp ?? "Unknown"}
            </p>
          </div>
          <button
            type="button"
            disabled={!currentIp || currentIpIsLoopback || pending}
            onClick={addCurrentIp}
            className="inline-flex min-h-[40px] flex-none cursor-pointer items-center gap-1.5 rounded-full border border-(--accent-border) bg-(--bg) px-3.5 text-[13px] font-semibold text-(--accent-ink) transition-colors duration-150 enabled:hover:bg-(--accent-soft) disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Use this IP
          </button>
        </div>
        {/* {currentIpIsLoopback ? (
          <p className="mt-2.5 text-[12px] leading-relaxed text-(--text)">
            You are accessing the app via localhost. This address only works on the
            server itself and cannot be used by other devices — open the app using
            the server&apos;s LAN IP to add the store WiFi IP.
          </p>
        ) : currentIpIsPrivate ? (
          <p className="mt-2.5 text-[12px] leading-relaxed text-amber-700">
            This is a private (LAN) IP — normal when the app runs on a machine in the
            store. If the app runs on a VPS, check that nginx forwards the X-Real-IP
            header; in that case you need to add the store&apos;s public IP.
          </p>
        ) : null} */}
        {!currentIp ? (
          <p className="mt-2.5 text-[12px] leading-relaxed text-amber-700">
            Could not read the IP from the request. Run the app behind nginx and configure
            X-Real-IP/X-Forwarded-For, or enter the public IP manually below.
          </p>
        ) : null}
      </div>

      {rules.length === 0 ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No IP addresses yet — all scans will be blocked. Add the store WiFi range (e.g. 192.168.1.0/24).
        </p>
      ) : null}

      <form ref={formRef} onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="network-value" className="text-sm font-semibold text-(--text-h)">
            IP or IP range
          </label>
          <input
            id="network-value"
            name="value"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="192.168.1.0/24"
            className={INPUT}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="network-label" className="text-sm font-semibold text-(--text-h)">
            Note (optional)
          </label>
          <input
            id="network-label"
            name="label"
            maxLength={80}
            placeholder="Store WiFi"
            className={INPUT}
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="rounded-xl border border-(--accent-border) bg-(--accent-bg) px-3 py-2.5 text-sm font-medium text-(--accent-ink)">
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-(--accent-border) bg-(--accent-soft) text-[17px] font-semibold text-(--accent-ink) transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] enabled:hover:border-(--accent) enabled:hover:bg-(--accent-soft-hover) active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-none"
        >
          {pending ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
          Add IP
        </button>
      </form>

      <ul className="flex flex-col gap-2.5">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="flex items-center gap-3 rounded-[18px] border border-(--border) bg-(--bg) p-4"
          >
            <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-(--accent-bg) text-(--accent)">
              <Wifi size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[15px] font-semibold text-(--text-h)">
                {rule.value}
              </p>
              {rule.label ? (
                <p className="truncate text-[13px] text-(--text)">{rule.label}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={`Delete ${rule.value}`}
              disabled={busyId === rule.id}
              onClick={() => remove(rule)}
              className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-xl border border-(--border) text-red-600 transition-colors duration-150 enabled:hover:border-red-300 enabled:hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyId === rule.id ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
            </button>
          </li>
        ))}
      </ul>

      <p className="text-[13px] leading-relaxed text-(--text)">
        Employees can only scan while connected to the store WiFi. Use an IP range (CIDR) so
        you don&apos;t have to update it when the router assigns a new IP.
      </p>
    </div>
  );
}
