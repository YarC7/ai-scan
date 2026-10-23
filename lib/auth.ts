import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { betterAuth } from "better-auth";
import { getPool } from "./db";
import { isIpAllowed } from "./allowlist";
import { getClientIp, isLoopbackIp } from "./ip";
import { ac, employee, owner } from "./permissions";

function extraTrustedOrigins(): string[] {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export const auth = betterAuth({
  appName: "AI Scan",
  database: getPool(),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (request) => {
    const origins = extraTrustedOrigins();
    const origin = request?.headers.get("origin");
    const host = request?.headers.get("host");

    if (origin && host) {
      try {
        if (new URL(origin).host === host) origins.push(origin);
      } catch {
        // Ignore malformed Origin headers.
      }
    }

    return origins;
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        throw new APIError("FORBIDDEN", {
          message:
            "Public sign-up is disabled. Contact the store owner to get an account.",
        });
      }

      if (ctx.path !== "/sign-in/email") return;

      const requestHeaders = ctx.headers ?? ctx.request?.headers;
      if (!requestHeaders) return;

      const clientIp = getClientIp(requestHeaders);
      if (clientIp && (isLoopbackIp(clientIp) || (await isIpAllowed(clientIp)))) {
        return;
      }

      const email = (ctx.body as { email?: unknown } | undefined)?.email;
      const user =
        typeof email === "string"
          ? await ctx.context.internalAdapter.findUserByEmail(email)
          : null;

      if ((user?.user as { role?: string | null } | undefined)?.role === "owner") return;

      throw new APIError("FORBIDDEN", {
        message:
          "This device is not connected to the store WiFi, so sign-in is unavailable. Please connect to WiFi and try again.",
      });
    }),
  },
  plugins: [
    admin({
      ac,
      roles: { owner, employee },
      defaultRole: "employee",
      adminRoles: ["owner"],
      bannedUserMessage:
        "Your account has been disabled. Contact the store owner for help.",
    }),
    nextCookies(),
  ],
});
