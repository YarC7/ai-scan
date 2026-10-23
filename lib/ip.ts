import ipaddr from "ipaddr.js";

export const IP_NOT_ALLOWED_CODE = "IP_NOT_ALLOWED";

type ParsedAddress = ipaddr.IPv4 | ipaddr.IPv6;

function canonical(address: ParsedAddress): string {
  if (address instanceof ipaddr.IPv6 && address.isIPv4MappedAddress()) {
    return address.toIPv4Address().toNormalizedString();
  }
  return address.toNormalizedString();
}

function comparable(address: ParsedAddress): ParsedAddress {
  if (address instanceof ipaddr.IPv6 && address.isIPv4MappedAddress()) {
    return address.toIPv4Address();
  }
  return address;
}

function parseAddress(value: string): ParsedAddress | null {
  try {
    return ipaddr.parse(value);
  } catch {
    return null;
  }
}

const NON_PUBLIC_RANGES = new Set([
  "private",
  "loopback",
  "linkLocal",
  "uniqueLocal",
  "carrierGradeNat",
  "unspecified",
  "reserved",
  "broadcast",
  "multicast",
  "ipv4Mapped",
]);

export function isPrivateIp(ip: string): boolean {
  const address = parseAddress(ip);
  if (!address) return false;
  return NON_PUBLIC_RANGES.has(address.range());
}

export function isLoopbackIp(ip: string): boolean {
  const address = parseAddress(ip);
  return address !== null && address.range() === "loopback";
}

export function getClientIp(requestHeaders: Headers): string | null {
  const forwarded = requestHeaders.get("x-forwarded-for");
  const candidate =
    requestHeaders.get("x-real-ip")?.trim() ||
    forwarded?.split(",")[0]?.trim() ||
    requestHeaders.get("cf-connecting-ip")?.trim();

  if (!candidate) return null;

  const address = parseAddress(candidate);
  return address ? canonical(address) : null;
}

export function normalizeIpRule(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  try {
    if (value.includes("/")) {
      const [address, bits] = ipaddr.parseCIDR(value);
      const mapped = comparable(address);
      if (mapped.kind() === "ipv4" && bits > 32) return null;
      return `${mapped.toNormalizedString()}/${bits}`;
    }

    return canonical(ipaddr.parse(value));
  } catch {
    return null;
  }
}

export function ipMatchesRule(ip: string, rule: string): boolean {
  const address = parseAddress(ip);
  if (!address) return false;

  try {
    if (rule.includes("/")) {
      const [network, bits] = ipaddr.parseCIDR(rule);
      const target = comparable(address);
      if (target.kind() !== network.kind()) return false;
      return target.match(network, bits);
    }

    const target = parseAddress(rule);
    return target !== null && canonical(address) === canonical(target);
  } catch {
    return false;
  }
}
