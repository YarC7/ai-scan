import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

const SCRYPT_CONFIG = { N: 16384, r: 16, p: 1, dkLen: 64 };

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(
      password.normalize("NFKC"),
      salt,
      SCRYPT_CONFIG.dkLen,
      {
        N: SCRYPT_CONFIG.N,
        r: SCRYPT_CONFIG.r,
        p: SCRYPT_CONFIG.p,
        maxmem: 128 * SCRYPT_CONFIG.N * SCRYPT_CONFIG.r * 2,
      },
      (error, key) => {
        if (error) reject(error);
        else resolve(`${salt}:${key.toString("hex")}`);
      },
    );
  });
}

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      let value = rawValue.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=");
    args[key] = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
  }
  return args;
}

loadEnv();

const args = parseArgs(process.argv.slice(2));
const username = (args.username ?? process.env.SEED_OWNER_USERNAME ?? "")
  .trim()
  .toLowerCase();
const name = (args.name ?? process.env.SEED_OWNER_NAME ?? "").trim();
const password = args.password ?? process.env.SEED_OWNER_PASSWORD ?? "";

if (!username || !name || !password) {
  console.error(
    'Usage: node scripts/seed-owner.mjs --username owner --name "Store Owner" --password "password123"',
  );
  process.exit(1);
}

if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
  console.error(
    "Username must be 3-30 characters: letters, digits, dots or underscores.",
  );
  process.exit(1);
}

const email = `${username}@aiscan.local`;

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL. Add it to .env (see .env.example).");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const existing = await client.query(
    'select id, role from "user" where email = $1 limit 1',
    [email],
  );

  if (existing.rowCount) {
    await client.query("COMMIT");
    console.log(
      `Owner ${username} already exists (role: ${existing.rows[0].role ?? "employee"}), skipping seed.`,
    );
  } else {
    const userId = randomUUID();
    const now = new Date();
    const passwordHash = await hashPassword(password);

    await client.query(
      `insert into "user"
        ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "role", "banned")
       values ($1, $2, $3, true, $4, $5, 'owner', false)`,
      [userId, name, email, now, now],
    );

    await client.query(
      `insert into "account"
        ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
       values ($1, $2, 'credential', $3, $4, $5, $6)`,
      [randomUUID(), userId, userId, passwordHash, now, now],
    );

    await client.query("COMMIT");
    console.log(`Owner created: ${username}`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  if (error.code === "42P01") {
    console.error('Table "user" does not exist. Run: npm run db:migrate');
  } else {
    console.error("Failed to seed owner:", error.message);
  }
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
