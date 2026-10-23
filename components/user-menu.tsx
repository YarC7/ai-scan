"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Loader2, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { getInitials } from "@/lib/initials";
import { emailToUsername } from "@/lib/username";

const MENU_ITEM =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-150";

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await authClient.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  if (isPending) {
    return (
      <div
        className="ml-auto size-11 flex-none rounded-full border border-(--border) bg-(--code-bg)"
        aria-hidden="true"
      />
    );
  }

  if (!session) return null;

  const role = (session.user as { role?: string | null }).role;
  const isOwner = role === "owner";
  const username = emailToUsername(session.user.email);
  const initials = getInitials(session.user.name);
  const showAdminLink = isOwner && !pathname.startsWith("/admin");

  return (
    <div ref={rootRef} className="relative ml-auto flex-none">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Open account menu"
        onClick={() => setOpen((value) => !value)}
        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border py-1 pr-2.5 pl-1 transition-colors duration-150 ${
          open
            ? "border-(--accent-border) bg-(--accent-bg)"
            : "border-(--border) bg-(--bg) hover:border-(--accent-border) hover:bg-(--accent-bg)"
        }`}
      >
        <span className="grid size-9 place-items-center rounded-full bg-(--accent-soft) text-[13px] font-bold text-(--accent-ink)">
          {initials}
        </span>
        <ChevronDown
          size={16}
          className={`text-(--text) transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="menu-in absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-(--border) bg-(--bg) p-1.5 shadow-[0_24px_60px_-24px_rgba(8,6,13,0.5)]"
        >
          <div className="flex items-center gap-3 px-2.5 py-2">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-(--accent-soft) text-sm font-bold text-(--accent-ink)">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-(--text-h)">
                {session.user.name}
              </p>
              <p className="truncate text-[12px] text-(--text)">@{username}</p>
            </div>
          </div>

          <div className="px-2.5 pb-1">
            <span className="inline-flex rounded-full border border-(--accent-border) bg-(--accent-bg) px-2 py-0.5 text-[11px] font-semibold text-(--accent)">
              {isOwner ? "Owner" : "Employee"}
            </span>
          </div>

          <div className="my-1.5 h-px bg-(--border)" />

          {showAdminLink ? (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`${MENU_ITEM} text-(--text-h) hover:bg-(--accent-bg) hover:text-(--accent-ink)`}
            >
              <ShieldCheck size={17} />
              Admin
            </Link>
          ) : null}

          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={handleSignOut}
            className={`${MENU_ITEM} text-red-600 enabled:hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {signingOut ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <LogOut size={17} />
            )}
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
