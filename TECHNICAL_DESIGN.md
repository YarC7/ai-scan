# AI Scan - Technical Design

System: Boba order label scanner with role-based access, network policy, and ML extraction via Groq.

## Architecture

**Stack**: Next.js 16.3 + React 19 + PostgreSQL + Better Auth 1.7

**Three-layer auth model**:
1. **Edge** (proxy.ts): Optimistic redirect. Cookie presence only. No DB hit.
2. **Server** (lib/session.ts, page layouts): Authoritative. Session, ban, role, IP checks.
3. **Database** (PostgreSQL): Single source of truth. Identity, credentials, policy.

Data flows: Browser → Edge → Server → Postgres. Server re-checks every sensitive call.

## Authentication

**Session**: 7 days expiry. Daily refresh window. HttpOnly cookie.

**Password**: Scrypt N=16384 r=16 p=1, 64-byte key. Never sent client-side.

**Sign-up**: Always 403. Owner seeded via `npm run db:seed-owner`.

**Rate limits**:
- Sign-in: 5 attempts/min per IP
- General: 10 requests/min per IP
- Groq API: Passes Retry-After; waits are client-side

## Access Control

**Roles**: Owner (admin) | Employee (user). Default: Employee.

**Network policy**:
- Loopback (127.0.0.1, ::1): Always allowed.
- DB-backed CIDR allowlist (allowed_ip table).
- Owner: Bypasses IP check.
- Employee: Must match allowlist + loopback.

**Surfaces**:
- `/`: Edge redirects to /login if no session.
- `/scan/*`: requireSession(). Rejects banned, missing.
- `/admin/*`: requireOwner(). Employee access denied.
- `POST /api/scan`: Session + ban + IP checks before Groq call.

**Ban enforcement**: Page guards + API checks. Banned users signed out immediately.

## Data Model

**user**
- id, email (unique), name
- role: "owner" | "employee" | null
- banned: boolean. banReason, banExpires timestamps.
- createdAt, updatedAt

**session**
- id, token (unique), expiresAt
- userId (FK → user)
- ipAddress, userAgent (optional)
- createdAt, updatedAt

**account**
- id, userId (FK → user)
- providerId: "email-password"
- password: Scrypt hash
- (OAuth fields reserved, unused)

**allowed_ip**
- id, value (CIDR string, unique)
- label: Human-readable (e.g., "Store WiFi")
- createdAt

## API Endpoints

**POST /api/scan**
- Input: { dataUrl: "data:image/..." }
- Checks: Session exists. User not banned. IP allowed or owner.
- Calls: Groq chat completions (qwen/qwen3.8-27b).
- Output: { drink_name, modifiers, recipe, _validation, ... }
- Errors: 401 (no session), 403 (banned/IP), 413 (image size), 429 (rate limit).

**POST /api/auth/***
- Better Auth routes. Sign-in enforces IP + rate limit via lib/auth.ts hook.
- Sign-up always 403.

**Admin mutations** (lib/admin/network/actions.ts)
- requireOwner() guards + Better Auth admin permissions.
- Add/remove IP rules, manage staff roles.

## Deployment

1. `npm run db:migrate`: Create schema. Idempotent.
2. `npm run db:seed-owner`: One bootstrap owner account.
3. Set env: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL.
4. (Optional) BETTER_AUTH_TRUSTED_ORIGINS: Comma-separated extra origins.
5. (Optional) GROQ_API_KEY: For /api/scan calls.
6. Start app. Owner logs in, opens Admin → Network, adds staff IPs/CIDR.

**Vercel note**: Use store's public egress IP for allowlist. Never 192.168.x.x. Run migrate/seed before traffic, not during build.

## Security Posture

**Enforced**:
- Server-side session validation on every request.
- HttpOnly session cookies (no JS access).
- Scrypt password hashing with high cost.
- IP-based network boundary enforcement.
- Ban state checked on every sensitive operation.
- Same-origin policy + explicit trusted origins.
- Public sign-up disabled by default.

**Residual risks**:
- IP ≠ identity (CGNAT, cellular, dynamic egress breaks gate).
- Rate limit: Serverless instances don't share state. Per-instance limits only.
- No MFA. Password + network is single factor.
- No audit log. Account, ban, password actions unrecorded.
- Header trust: Deploy behind Vercel or explicit trusted proxy only.

## Extensibility

**Add new role**: 
- Define in lib/permissions.ts (ac + role object).
- Add route guard: `requireRole('newrole')`.
- Seed initial user via admin API or script.

**Add new API guard**:
- Use lib/session.ts exports: `requireSession()`, `requireOwner()`, `getClientIp()`, `isIpAllowed()`.
- Check ban state via session.user.banned.

**IP allowlist CRUD**:
- Admin UI: Admin → Network (add/remove entries).
- Direct: POST /api/admin/network with requireOwner() guard.

## Known Limitations

- No MFA or passwordless auth.
- No login audit trail.
- Scrypt cost (N=16384) tuned for human authentication; higher for machine-generated passwords.
- Groq API dependency: If Groq down, /api/scan fails. No fallback model.
- CIDR parsing: Uses ipaddr.js. IPv6 support depends on address format.

## Files Map

```
lib/
  auth.ts                 # Better Auth config, IP hook, rate limit
  session.ts              # Session guards (requireSession, requireOwner)
  allowlist.ts            # IP CIDR parsing, allowlist checks
  ip.ts                   # getClientIp, isLoopbackIp
  permissions.ts          # Role definitions (ac, owner, employee)
  db.ts                   # PostgreSQL pool
  validateLabel.ts        # Label fuzzy correction vs menu
  recipes.ts              # Recipe lookup by drink + sweetness
  
app/
  api/scan/route.ts       # Groq extraction endpoint
  api/auth/[...all]/route.ts  # Better Auth routes
  (scan)/layout.tsx       # requireSession() guard
  (admin)/layout.tsx      # requireOwner() guard
  (admin)/admin/network/actions.ts  # IP management
  
db/
  migration.sql           # Schema: user, session, account, allowed_ip
  
public/design/
  auth-system.html        # Design doc (architecture, threat model)
  employee-management.html # Admin UI design
```

---

**Version**: 2.0 (2026-10-22)  
**Status**: Source-verified against current repo.  
**Next review**: When major auth, role, or network policy changes.
