import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error;
  const initialError =
    errorParam === "banned"
      ? "Your account has been disabled. Contact the store owner."
      : null;

  return <LoginForm initialError={initialError} />;
}
