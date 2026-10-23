import { randomUUID } from "node:crypto";
import { getPool } from "./db";
import { ipMatchesRule } from "./ip";

export type AllowedIp = {
  id: string;
  value: string;
  label: string;
  createdAt: Date;
};

export async function listAllowedIps(): Promise<AllowedIp[]> {
  const { rows } = await getPool().query<AllowedIp>(
    'select "id", "value", "label", "createdAt" from "allowed_ip" order by "createdAt" asc',
  );
  return rows;
}

export async function isIpAllowed(ip: string): Promise<boolean> {
  const rules = await listAllowedIps();
  return rules.some((rule) => ipMatchesRule(ip, rule.value));
}

export async function addAllowedIp(value: string, label: string): Promise<AllowedIp> {
  const { rows } = await getPool().query<AllowedIp>(
    `insert into "allowed_ip" ("id", "value", "label")
     values ($1, $2, $3)
     returning "id", "value", "label", "createdAt"`,
    [randomUUID(), value, label],
  );
  return rows[0];
}

export async function deleteAllowedIp(id: string): Promise<void> {
  await getPool().query('delete from "allowed_ip" where "id" = $1', [id]);
}
