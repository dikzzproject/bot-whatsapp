const { exec: runShell } = childProcess;
const { sendOutput } = ownerKit;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const COMMAND_PATTERN = /^(=>|>|\$)\s+([\s\S]+)$/;
const SHELL_TIMEOUT_MS = 60000;
const SHELL_MAX_BUFFER = 5 * 1024 * 1024;

const format = value =>
    typeof value === "string" ? value : util.inspect(value, { depth: 3, maxArrayLength: 50, breakLength: 100 });

async function evaluate(code, scope) {
    const names = Object.keys(scope);
    const values = Object.values(scope);
    let fn;
    try {
        fn = new AsyncFunction(...names, `return (${code})`);
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        fn = new AsyncFunction(...names, code);
    }
    return fn(...values);
}

const shell = command =>
    new Promise(resolve => {
        runShell(
            command,
            { cwd: config.paths.root, timeout: SHELL_TIMEOUT_MS, maxBuffer: SHELL_MAX_BUFFER },
            (error, stdout, stderr) => resolve({ error, stdout, stderr })
        );
    });

async function runEval(m, ctx, code, showUndefined) {
    const scope = { m, ctx, sock: ctx.sock, conn: ctx.sock, db: ctx.db, config, fs, os, path, util };
    try {
        const result = await evaluate(code, scope);
        if (result === undefined && !showUndefined) return m.react("✅");
        return sendOutput(m, ctx, format(result));
    } catch (error) {
        return sendOutput(m, ctx, error?.stack ?? String(error));
    }
}

async function runShellCommand(m, ctx, command) {
    await m.react("⏳");
    const { error, stdout, stderr } = await shell(command);
    const parts = [stdout, stderr].map(part => part.trim()).filter(Boolean);
    if (error?.killed) parts.push(`⏱️ Dihentikan selepas ${SHELL_TIMEOUT_MS / 1000} saat.`);
    else if (error && error.code) parts.push(`❌ Kod keluar: ${error.code}`);
    return sendOutput(m, ctx, parts.join("\n\n") || "✅ Selesai (tiada output)");
}

export default {
    tags: ["owner"],
    hidden: true,
    before: async (m, ctx) => {
        if (!ctx.isOwner || ctx.sock.isJadibot || ctx.command || !m.text) return false;

        const match = m.text.match(COMMAND_PATTERN);
        if (!match) return false;

        const [, operator, code] = match;
        if (operator === "$") await runShellCommand(m, ctx, code);
        else await runEval(m, ctx, code, operator === "=>");
        return true;
    }
};
