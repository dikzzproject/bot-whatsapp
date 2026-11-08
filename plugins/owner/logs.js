const { OWNER_ONLY, sendOutput } = ownerKit;

const LOG_FILE = path.join(ensureDir(config.paths.data), "error.log");
const MAX_BYTES = 2 * 1024 * 1024;
const KEEP_BYTES = 512 * 1024;
const DEFAULT_LINES = 40;

const stringify = value => (value instanceof Error ? value.stack || value.message : typeof value === "string" ? value : util.inspect(value, { depth: 2 }));

function trimLog() {
    try {
        if (fs.statSync(LOG_FILE).size <= MAX_BYTES) return;
        const data = fs.readFileSync(LOG_FILE);
        fs.writeFileSync(LOG_FILE, data.subarray(data.length - KEEP_BYTES));
    } catch {
        return;
    }
}

globalThis.__errorLogOriginal ??= log.error;
log.error = (label, message, ...extra) => {
    try {
        const body = [message, ...extra].filter(item => item !== undefined && item !== "").map(stringify).join("\n");
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [${String(label).toUpperCase()}]\n${body}\n\n`);
        trimLog();
    } catch {
        return globalThis.__errorLogOriginal(label, message, ...extra);
    }
    return globalThis.__errorLogOriginal(label, message, ...extra);
};

export default {
    ...OWNER_ONLY,
    command: ["checkerror", "errorlog", "chkerr"],
    help: ["checkerror [lines|clear]", "errorlog [lines|clear]", "chkerr [lines|clear]"],
    exec: (m, ctx) => {
        const arg = (ctx.args[0] ?? "").toLowerCase();

        if (arg === "clear") {
            fs.writeFileSync(LOG_FILE, "");
            return m.reply("🧹 Log ralat dikosongkan.");
        }

        if (!fs.existsSync(LOG_FILE) || !fs.statSync(LOG_FILE).size) return m.reply("✅ Tiada ralat direkodkan.");

        const count = Math.min(Math.max(parseInt(arg, 10) || DEFAULT_LINES, 1), 500);
        const lines = fs.readFileSync(LOG_FILE, "utf8").trimEnd().split("\n");
        return sendOutput(m, ctx, `🐞 *Log Ralat* (${Math.min(count, lines.length)}/${lines.length} baris)\n\n${lines.slice(-count).join("\n")}`);
    }
};
