const USERNAME_DOMAIN = "aiscan.local";

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  const normalized = email.trim().toLowerCase();
  const suffix = `@${USERNAME_DOMAIN}`;
  return normalized.endsWith(suffix) ? normalized.slice(0, -suffix.length) : normalized;
}

export function validateUsername(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return "Username must be 3-30 characters and contain only letters, numbers, dots or underscores.";
  }
  return null;
}
