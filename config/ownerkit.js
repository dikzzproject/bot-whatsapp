const { execFile } = childProcess;

const ROOT = config.paths.root;
const OWNER_ONLY = { tags: ["owner"], owner: true, official: true };

const SEARCH_IGNORED = new Set(["node_modules", ".git", "auth", "tmp"]);
const PROTECTED_DIRS = ["auth", "node_modules", ".git"];
const PROTECTED_FILES = [".env", "package.json", "package-lock.json", "main.js", "index.js"];
const MAX_SEARCH_DEPTH = 6;

const toRelative = absolute => path.relative(ROOT, absolute).split(path.sep).join("/") || ".";

const parseSwitch = value => {
    if (/^(on|1|true|hidup|aktif)$/i.test(value ?? "")) return true;
    if (/^(off|0|false|mati)$/i.test(value ?? "")) return false;
    return null;
};

const parseDays = value => {
    if (/^(perm|permanen|permanent|selamanya|0)$/i.test(value ?? "")) return 0;
    const days = Number(value);
    return Number.isInteger(days) && days > 0 && days <= 36500 ? days : null;
};

function resolveSafe(input) {
    const value = String(input ?? "").trim().replace(/^["']|["']$/g, "");
    if (!value || value.includes("\0")) throw new UserError("Laluan tidak sah.");
    const absolute = path.resolve(ROOT, value);
    if (absolute !== ROOT && !absolute.startsWith(ROOT + path.sep)) {
        throw new UserError("Laluan di luar folder projek tidak dibenarkan.");
    }
    return absolute;
}

function isInProtectedDir(absolute) {
    const relative = toRelative(absolute);
    return PROTECTED_DIRS.some(dir => relative === dir || relative.startsWith(`${dir}/`));
}

function isProtected(absolute) {
    return isInProtectedDir(absolute) || PROTECTED_FILES.includes(toRelative(absolute));
}

function findFiles(name, dir = ROOT, depth = 0, found = []) {
    if (depth > MAX_SEARCH_DEPTH) return found;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SEARCH_IGNORED.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) findFiles(name, full, depth + 1, found);
        else if (entry.name === name || entry.name === `${name}.js`) found.push(full);
    }
    return found;
}

function locate(input) {
    const value = String(input ?? "").trim();
    if (!value) throw new UserError("Nyatakan nama fail atau laluan.");
    const direct = resolveSafe(value);
    if (fs.existsSync(direct)) return direct;

    const matches = findFiles(path.basename(value));
    if (!matches.length) throw new UserError(`Fail "${value}" tidak dijumpai.`);
    if (matches.length > 1) {
        throw new UserError(`Terdapat ${matches.length} fail sepadan, nyatakan laluan penuh:\n${matches.map(file => `• ${toRelative(file)}`).join("\n")}`);
    }
    return matches[0];
}

function moveToTrash(absolute, { copy = false } = {}) {
    const dir = ensureDir(path.join(config.paths.tmp, "trash"));
    const target = path.join(dir, `${Date.now()}-${path.basename(absolute)}`);
    if (copy) fs.copyFileSync(absolute, target);
    else {
        try {
            fs.renameSync(absolute, target);
        } catch {
            fs.copyFileSync(absolute, target);
            fs.rmSync(absolute, { force: true });
        }
    }
    return toRelative(target);
}

const checkSyntaxFile = file =>
    new Promise(resolve => {
        execFile(process.execPath, ["--check", file], { timeout: 20000 }, (error, stdout, stderr) => {
            if (!error) return resolve(null);
            resolve(String(stderr || error.message).split("\n").filter(Boolean).slice(0, 6).join("\n"));
        });
    });

async function checkSyntaxCode(code) {
    const file = tempPath("mjs");
    fs.writeFileSync(file, code);
    try {
        return await checkSyntaxFile(file);
    } finally {
        removeFile(file);
    }
}

async function sendOutput(m, ctx, text) {
    const content = String(text ?? "").trim() || "(kosong)";
    if (content.length <= 3800) return m.reply(content);
    return ctx.sock.sendMessage(
        m.chat,
        {
            document: Buffer.from(content),
            mimetype: "text/plain",
            fileName: "output.txt",
            caption: `Output terlalu panjang (${content.length} aksara)`
        },
        { quoted: m }
    );
}

function toUserId(ctx, jid) {
    if (!jid.endsWith("@lid")) return jid;
    const match = ctx.participants.find(item => item.id === jid || item.lid === jid);
    const number = match?.phoneNumber;
    if (number) return number.includes("@") ? number : toUserJid(number);
    throw new UserError("Nombor telefon pengguna itu tidak dapat dikesan. Guna nombor terus, contoh: 60123456789");
}

function pickTarget(m, ctx) {
    const rest = ctx.args.filter(arg => !/^@\d+$/.test(arg));
    let jid = m.target;
    if (!jid) {
        const number = rest.find(arg => /^\d{8,15}$/.test(arg));

        if (number) {
           if (jid?.endsWith("@lid")) {
              jid = toUserLid(number);
              rest.splice(rest.indexOf(number), 1);
           }
           else {
              jid = toUserJid(number);
              rest.splice(rest.indexOf(number), 1);
           }
           }
    }
    return { jid: jid ? toUserId(ctx, jid) : "", rest };
}

const bannedChats = db => (db.settings.bannedChats ??= {});
const rentals = db => (db.settings.rentals ??= {});

const formatDate = time =>
    time
        ? new Date(time).toLocaleString("ms-MY", { timeZone: config.bot.timezone, dateStyle: "medium", timeStyle: "short" })
        : "Selama-lamanya";

global.ownerKit = { ROOT, OWNER_ONLY, SEARCH_IGNORED, PROTECTED_DIRS, PROTECTED_FILES, MAX_SEARCH_DEPTH, toRelative, parseSwitch, parseDays, resolveSafe, isInProtectedDir, isProtected, findFiles, locate, moveToTrash, checkSyntaxFile, checkSyntaxCode, sendOutput, toUserId, pickTarget, bannedChats, rentals, formatDate };
