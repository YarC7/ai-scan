import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in · AI Scan",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center px-4 py-10">
      {children}
    </div>
  );
}
