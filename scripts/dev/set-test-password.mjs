#!/usr/bin/env node
// Dev-only. Sets a fresh random password on a TEST account so the Simulator can sign back in after
// flows that sign out (e.g. testing Delete Account on a throwaway). Refuses real-looking accounts.
// The password is written to scripts/dev/fixtures/test-account.json (gitignored), never printed.
//   node scripts/dev/set-test-password.mjs --account <email or uid prefix>
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initAdmin, findUser, mask } from "./lib/admin.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith("--") ? [a.slice(2), all[i + 1]] : []).filter(Boolean));
if (!args.account) { console.error("Usage: --account <email or uid prefix>"); process.exit(1); }

const { auth } = initAdmin();
const user = await findUser(auth, args.account);
if (!/@example\.(com|test)$|\+test@|^test/i.test(user.email ?? "")) { console.error(`Refusing: ${mask(user.email)} does not look like a test account.`); process.exit(1); }

const password = randomBytes(12).toString("base64url");
await auth.updateUser(user.uid, { password });
const out = join(here, "fixtures", "test-account.json");
mkdirSync(dirname(out), { recursive: true });
const existing = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
writeFileSync(out, JSON.stringify({ ...existing, [user.uid]: { email: user.email, password } }, null, 2), { mode: 0o600 });
console.log(`Password set for ${mask(user.email)}; saved to scripts/dev/fixtures/test-account.json`);
