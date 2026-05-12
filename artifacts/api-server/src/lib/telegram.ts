import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { logger } from "./logger";

const apiId = parseInt(process.env["TELEGRAM_API_ID"] ?? "0", 10);
const apiHash = process.env["TELEGRAM_API_HASH"] ?? "";
const sessionStr = process.env["TELEGRAM_SESSION"] ?? "";

let client: TelegramClient | null = null;

async function getClient(): Promise<TelegramClient> {
  if (client && client.connected) return client;

  const session = new StringSession(sessionStr);
  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false,
  });

  await client.connect();
  logger.info("Telegram client connected");
  return client;
}

export async function sendOtpViaTelegram(phone: string, code: string): Promise<void> {
  const tg = await getClient();
  const message = `🔐 كود التحقق الخاص بك على Cipher:\n\n<code>${code}</code>\n\n⏱ صالح لمدة 10 دقائق.`;
  await tg.sendMessage(phone, { message, parseMode: "html" });
  logger.info({ phone }, "OTP sent via Telegram");
}
