/**
 * Run once to generate a GramJS StringSession:
 *   pnpm --filter @workspace/scripts run gen-session
 *
 * Copy the printed session string and save it as TELEGRAM_SESSION secret.
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const apiId = parseInt(process.env["TELEGRAM_API_ID"] ?? "0", 10);
const apiHash = process.env["TELEGRAM_API_HASH"] ?? "";

if (!apiId || !apiHash) {
  console.error("❌  Set TELEGRAM_API_ID and TELEGRAM_API_HASH first");
  process.exit(1);
}

const rl = readline.createInterface({ input, output });

const session = new StringSession("");
const client = new TelegramClient(session, apiId, apiHash, {
  connectionRetries: 3,
});

await client.start({
  phoneNumber: async () => {
    return rl.question("📱 Phone number (international format, e.g. +201234567890): ");
  },
  password: async () => {
    return rl.question("🔑 2FA password (leave blank if none): ");
  },
  phoneCode: async () => {
    return rl.question("📨 Code you received on Telegram: ");
  },
  onError: (err) => {
    console.error("Error:", err.message);
  },
});

const sessionString = client.session.save() as unknown as string;

console.log("\n✅  Session generated successfully!\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("TELEGRAM_SESSION =", sessionString);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("\n👆 Copy this value and update the TELEGRAM_SESSION secret in Replit.");

await client.disconnect();
rl.close();
