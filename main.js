import config from "#config/global.js";
import db from "#database";
import log from "#logger";
import { loadAll, watchPlugins } from "#lib/plugins.js";
import startOfficialBot from "./src/socket.js";
import startHtmlJadibot from "#jadibot/htmljadibot.js";
import { restoreSessions, stopAll } from "#jadibot/manager.js";

let web = null;
let closing = false;

async function shutdown(signal) {
    if (closing) return;
    closing = true;
    log.warn("process", `${signal} diterima. Menyimpan data dan menutup sesi...`);
    web?.close();
    await stopAll().catch(() => null);
    db.stop();
    process.exit(0);
}

async function boot() {
    log.info("boot", `${config.bot.name} v${config.bot.version} dimulakan`);
    db.start();
    await loadAll();
    watchPlugins();
    await startOfficialBot();
    web = await startHtmlJadibot();
    restoreSessions().catch(error => log.error("jadibot", "Gagal memulihkan sesi", error));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("beforeExit", () => db.flush());
process.on("unhandledRejection", reason => log.error("process", "Unhandled rejection", reason));
process.on("uncaughtException", error => log.error("process", "Uncaught exception", error));

boot().catch(error => {
    log.error("boot", "Gagal memulakan bot", error);
    process.exit(1);
});
