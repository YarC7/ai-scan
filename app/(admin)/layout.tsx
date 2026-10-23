import Link from "next/link";
import { ArrowLeft, ShieldCheck, Wifi } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { requireOwner } from "@/lib/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwner();

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-4 pt-7 pb-[calc(28px+env(safe-area-inset-bottom))]">
      <div className="flex w-full items-center gap-3 text-left">
        <span className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-(--accent-soft) text-(--accent-ink) shadow-[0_8px_20px_-8px_rgba(8,6,13,0.4)]">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-(--text-h)">
            Admin
          </h1>
          <p className="mt-0.5 text-sm text-(--text)">Manage employees</p>
        </div>
        <UserMenu />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-(--accent)"
        >
          <ArrowLeft size={16} />
          Back to label scanning
        </Link>
        <Link
          href="/admin/network"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-(--text)"
        >
          <Wifi size={16} />
          Network &amp; IP
        </Link>
      </div>

      {children}
    </div>
  );
}
