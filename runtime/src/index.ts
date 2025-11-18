import "dotenv/config";
import pino from "pino";
import { createClient } from "@supabase/supabase-js";
import { EchoBotExecutor } from "./bot-executor.js";
import { SessionManager } from "./session-manager.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in runtime/.env");
  process.exit(1);
}

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const executor = new EchoBotExecutor();

const manager = new SessionManager(supabase, {
  sessionDataDir: process.env.SESSION_DATA_DIR ?? "./session-data",
  qrExpirySeconds: Number(process.env.QR_EXPIRY_SECONDS ?? "60"),
  executor,
  logger: {
    info: (msg, meta) => logger.info(meta ?? {}, msg),
    warn: (msg, meta) => logger.warn(meta ?? {}, msg),
    error: (msg, meta) => logger.error(meta ?? {}, msg),
    debug: (msg, meta) => logger.debug(meta ?? {}, msg),
  },
});

const pollInterval = Number(process.env.POLL_INTERVAL_MS ?? "15000");

async function run() {
  await manager.initialize();
  logger.info({ pollInterval }, "Starting WhatsApp runtime");

  const tick = async () => {
    try {
      console.log("Syncing pending numbers");
      await manager.syncPendingNumbers();
    } catch (error) {
      logger.error({ error }, "Failed to sync pending numbers");
    }
  };

  await tick();
  const interval = setInterval(tick, pollInterval);

  const shutdown = async () => {
    clearInterval(interval);
    await manager.shutdown();
    logger.info("Runtime shut down cleanly");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void run();
