"use server";

import { revalidatePath } from "next/cache";
import { addAllowedIp, deleteAllowedIp } from "@/lib/allowlist";
import { normalizeIpRule } from "@/lib/ip";
import { requireOwner } from "@/lib/session";

export type AllowlistActionResult = { ok: true } | { ok: false; error: string };

export async function createAllowedIp(formData: FormData): Promise<AllowlistActionResult> {
  await requireOwner();

  const value = normalizeIpRule(String(formData.get("value") ?? ""));
  const label = String(formData.get("label") ?? "").trim().slice(0, 80);

  if (!value) {
    return {
      ok: false,
      error: "Invalid IP or IP range. Example: 192.168.1.0/24",
    };
  }

  try {
    await addAllowedIp(value, label);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "This IP address/range is already in the list." };
    }
    throw error;
  }

  revalidatePath("/admin/network");
  return { ok: true };
}

export async function removeAllowedIp(id: string): Promise<AllowlistActionResult> {
  await requireOwner();
  await deleteAllowedIp(id);
  revalidatePath("/admin/network");
  return { ok: true };
}
