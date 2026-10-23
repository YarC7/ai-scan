import { requireSession } from "@/lib/session";

export default async function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return <>{children}</>;
}
