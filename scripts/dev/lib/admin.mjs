// Dev-only: firebase-admin initialised with the Firebase CLI's logged-in account (firebase login).
// Same approach the Firebase emulators use: an "authorized_user" credential from the CLI's refresh token and the
// CLI's own OAuth client, via a 0600 temp file removed on exit. Nothing is printed.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repo = resolve(here, "../../..");
export const PROJECT = "docwatch-mobile";
const require = createRequire(import.meta.url);

export function initAdmin() {
  const ftRoot = join(execSync("npm root -g", { encoding: "utf8" }).trim(), "firebase-tools");
  const cliAuth = require(join(ftRoot, "lib/auth.js"));
  const cliApi = require(join(ftRoot, "lib/api.js"));
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account) throw new Error("Run `firebase login` first.");
  const credFile = join(tmpdir(), `docwatch-admin-${process.pid}.json`);
  writeFileSync(credFile, JSON.stringify({ type: "authorized_user", client_id: cliApi.clientId(), client_secret: cliApi.clientSecret(), refresh_token: account.tokens.refresh_token }), { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credFile;
  process.env.GOOGLE_CLOUD_PROJECT = PROJECT;
  const cleanup = () => { try { unlinkSync(credFile); } catch {} };
  process.on("exit", cleanup); process.on("SIGINT", () => { cleanup(); process.exit(130); });

  const fnMods = join(repo, "functions/node_modules");
  const { initializeApp, applicationDefault } = require(join(fnMods, "firebase-admin/lib/app/index.js"));
  const { getFirestore } = require(join(fnMods, "firebase-admin/lib/firestore/index.js"));
  const { getStorage } = require(join(fnMods, "firebase-admin/lib/storage/index.js"));
  const { getAuth } = require(join(fnMods, "firebase-admin/lib/auth/index.js"));
  const local = JSON.parse(readFileSync(join(repo, "app/config.local.json"), "utf8"));
  const storageBucket = local?.extra?.firebase?.storageBucket;
  if (!storageBucket) throw new Error("storageBucket missing from app/config.local.json");
  initializeApp({ credential: applicationDefault(), projectId: PROJECT, storageBucket });
  return { db: getFirestore(), bucket: getStorage().bucket(), auth: getAuth() };
}

export const mask = (email = "") => email.replace(/^(.).*(@.*)$/, "$1***$2");

/** Email, or a uid prefix as shown by --list-accounts. */
export async function findUser(auth, q) {
  if (q.includes("@")) return auth.getUserByEmail(q);
  const u = (await auth.listUsers(100)).users.find((x) => x.uid.startsWith(q));
  if (!u) throw new Error(`no account matches ${q}`);
  return u;
}
