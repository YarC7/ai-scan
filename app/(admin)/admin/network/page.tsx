import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AllowlistManager } from "@/components/allowlist-manager";
import { listAllowedIps } from "@/lib/allowlist";
import { getClientIp, isLoopbackIp, isPrivateIp } from "@/lib/ip";

export default async function NetworkPage() {
  const [rules, requestHeaders] = await Promise.all([listAllowedIps(), headers()]);
  const currentIp = getClientIp(requestHeaders);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-(--text)"
      >
        <ArrowLeft size={16} />
        Employee list
      </Link>

      <div>
        <h2 className="text-xl font-semibold tracking-tight text-(--text-h)">
          Allowed WiFi networks
        </h2>
        <p className="mt-1 text-sm text-(--text)">
          Only devices with an IP matching the list below can scan labels.
        </p>
      </div>

      <AllowlistManager
        rules={rules}
        currentIp={currentIp}
        currentIpIsPrivate={currentIp !== null && isPrivateIp(currentIp)}
        currentIpIsLoopback={currentIp !== null && isLoopbackIp(currentIp)}
      />
    </div>
  );
}
