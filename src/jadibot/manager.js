import { bindConnection, isLinked } from "#client/connection.js";
import makeSocket from "#client/makeSocket.js";
import registerEvents from "#events/index.js";

const sessions = registry.jadibots;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,47}$/;
const PREFIX_PATTERN = /^[^\s\w]{1,3}$|^[a-z]{1,3}$/i;
const MODES = ["public", "self"];
const PLACEHOLDERS = ["prefix", "group", "sender", "user", "number", "time", "date", "botname", "command", "limit", "cost", "types"];

export const sessionDir = id => path.join(config.paths.auth, "jadibot", id);
export const isValidId = id => ID_PATTERN.test(String(id));
export const getPlaceholders = () => PLACEHOLDERS;

export function makeSessionId(name) {
    const base = slugify(name).slice(0, 20).replace(/-+$/g, "") || "bot";
    let id;
    do id = `${base}-${nodeCrypto.randomBytes(3).toString("hex")}`;
    while (db.jadibot.getSession(id) || sessions.has(id));
    return id;
}

export const normalizeQuery = value => String(value ?? "").trim();
export const getSession = id => sessions.get(id) ?? null;
export const getRecord = id => db.jadibot.getSession(id);
export const countActive = () => sessions.size;
export const unique = list => [...new Set(list.filter(Boolean))];

export function describe(id) {
    const record = db.jadibot.getSession(id);
    const live = sessions.get(id);
    if (!record && !live) return null;
    return {
        id,
        name: record?.name ?? "",
        number: live?.number || record?.number || "",
        pairNumber: record?.pairNumber ?? "",
        method: live?.method === "session" ? (record?.method ?? "pairing") : (live?.method ?? record?.method ?? "pairing"),
        status: live?.status ?? "offline",
        owners: record?.owners ?? [],
        ownerNumber: record?.ownerNumber ?? "",
        accountEmail: record?.accountEmail ?? "",
        source: record?.source ?? "",
        createdAt: record?.createdAt ?? 0,
        lastConnectedAt: record?.lastConnectedAt ?? 0,
        pairingCode: live?.pairingCode ?? "",
        hasQr: Boolean(live?.qr),
        settings: record?.settings ?? null
    };
}

export const listAll = () => db.jadibot.listSessions().map(item => describe(item.id));

export function resolveSession(query, { onlyIds } = {}) {
    const text = normalizeQuery(query);
    if (!text) throw new UserError("Nyatakan nama bot, nama sesi atau nombor.");
    let found = db.jadibot.findSessions(text);
    if (onlyIds) found = found.filter(item => onlyIds.includes(item.id));
    if (!found.length) throw new UserError(`Jadibot "${text}" tidak dijumpai.`);
    if (found.length > 1) {
        throw new UserError(
            `Terdapat ${found.length} padanan, gunakan nama sesi yang tepat:\n${found.map(item => `• ${item.name} — ${item.id}`).join("\n")}`
        );
    }
    return found[0];
}

export function canCreate({ ownerKey = "", numbers = [], isOwner = false, isPremium = false }) {
    const rules = config.jadibot;
    if (!rules.enabled) return { ok: false, message: "Jadibot dimatikan buat masa ini." };
    if (numbers.some(number => number && db.jadibot.isBanned(number))) {
        return { ok: false, message: "🚫 Nombor ini dilarang menggunakan jadibot." };
    }
    if (!isOwner && !rules.free && !isPremium) return { ok: false, message: "💎 Jadibot hanya untuk pengguna premium." };
    if (db.jadibot.listSessions().length >= rules.maxActive) return { ok: false, message: "Slot jadibot penuh. Cuba sebentar lagi." };
    if (!isOwner && ownerKey) {
        const owned = db.jadibot.listSessions().filter(item => item.ownerKey === ownerKey).length;
        if (owned >= rules.maxPerUser) {
            return { ok: false, message: `Anda hanya boleh mempunyai ${rules.maxPerUser} jadibot. Padam satu dahulu dengan .killjadibot` };
        }
    }
    return { ok: true };
}

export function sanitizeSettings(patch = {}) {
    const clean = {};
    if (patch.name !== undefined) {
        const name = String(patch.name).trim();
        if (name.length < 3 || name.length > 25) throw new UserError("Nama bot mesti 3 hingga 25 aksara.");
        clean.name = name;
    }
    if (patch.prefix !== undefined) {
        const list = unique(toArray(patch.prefix).map(item => String(item).trim()));
        if (!list.length || list.length > 5 || list.some(item => !PREFIX_PATTERN.test(item))) {
            throw new UserError("Awalan: 1 hingga 5 aksara, setiap satu 1-3 simbol atau huruf tanpa ruang.");
        }
        clean.prefix = list;
    }
    if (patch.mode !== undefined) {
        if (!MODES.includes(patch.mode)) throw new UserError("Mod mesti public atau self.");
        clean.mode = patch.mode;
    }
    if (patch.limit !== undefined) {
        const daily = Number(patch.limit?.daily ?? patch.limit);
        if (!Number.isInteger(daily) || daily < 0 || daily > 100000) throw new UserError("Had harian mesti nombor 0 hingga 100000 (0 = tanpa had).");
        clean.limit = { daily };
    }
    if (patch.messages !== undefined) {
        const known = global.botConfig.getMessageKeys();
        clean.messages = {};
        for (const [key, value] of Object.entries(patch.messages)) {
            if (!known.includes(key)) throw new UserError(`Kunci mesej "${key}" tidak dikenali.`);
            const text = String(value ?? "");
            if (text.length > 600) throw new UserError(`Mesej "${key}" terlalu panjang (maksimum 600 aksara).`);
            clean.messages[key] = text;
        }
    }
    return clean;
}

export function updateSettings(id, patch) {
    const record = db.jadibot.getSession(id);
    if (!record) throw new UserError("Jadibot tidak dijumpai.");
    const clean = sanitizeSettings(patch);
    record.settings ??= {};
    deepDefaults(record.settings, structuredClone(config.jadibot.defaults));
    if (clean.name) record.name = clean.name;
    if (clean.prefix) record.settings.prefix = clean.prefix;
    if (clean.mode) record.settings.mode = clean.mode;
    if (clean.limit) record.settings.limit = clean.limit;
    if (clean.messages) Object.assign(record.settings.messages, clean.messages);
    record.updatedAt = Date.now();
    return describe(id);
}

export function resetMessages(id, key = "all") {
    const record = db.jadibot.getSession(id);
    if (!record) throw new UserError("Jadibot tidak dijumpai.");
    record.settings ??= {};
    const defaults = config.jadibot.defaults.messages;
    if (key === "all") record.settings.messages = structuredClone(defaults);
    else if (key in defaults) record.settings.messages[key] = defaults[key];
    else throw new UserError(`Kunci mesej "${key}" tidak dikenali.`);
    return describe(id);
}

export function setOwner(id, action, number) {
    const record = db.jadibot.getSession(id);
    if (!record) throw new UserError("Jadibot tidak dijumpai.");
    const digits = cleanNumber(number);
    if (digits.length < 6) throw new UserError("Nombor tidak sah.");
    record.owners ??= [];
    if (action === "add") record.owners = unique([...record.owners, digits]);
    else {
        const protectedParts = [record.number, record.pairNumber, ...(record.requesterParts ?? [])];
        if (protectedParts.includes(digits)) throw new UserError("Pemilik asal bot tidak boleh dibuang.");
        record.owners = record.owners.filter(owner => owner !== digits);
    }
    return describe(id);
}

function clearTimers(entry) {
    clearTimeout(entry.pendingTimer);
    clearTimeout(entry.reconnectTimer);
    entry.pendingTimer = null;
    entry.reconnectTimer = null;
}

async function notify(entry, hook, ...args) {
    try {
        await entry.hooks?.[hook]?.(...args);
    } catch (error) {
        log.error("jadibot", `Ralat pada hook ${hook}`, error);
    }
}

async function destroy(entry, { remove, reason, keepRecord = false, silent = false }) {
    entry.stopping = true;
    clearTimers(entry);
    const sock = entry.sock;
    entry.sock = null;

    if (sock) {
        try {
            if (remove && isLinked(sock)) await sock.logout();
            else sock.end(undefined);
        } catch {
            sock.ws?.close?.();
        }
    }

    sessions.delete(entry.id);
    if (remove) {
        fs.rmSync(sessionDir(entry.id), { recursive: true, force: true });
        db.jadibot.removeSession(entry.id);
    } else if (!keepRecord) {
        db.jadibot.saveSession(entry.id, { status: "stopped" });
    }
    entry.status = "stopped";
    if (!silent) await notify(entry, "onRemoved", reason);
}

function scheduleReconnect(entry) {
    entry.attempts++;
    if (entry.attempts > config.jadibot.maxReconnect) {
        destroy(entry, { remove: false, reason: "Terlalu banyak percubaan sambung semula." });
        return;
    }
    entry.status = "reconnecting";
    const delay = Math.min(60000, config.jadibot.reconnectDelay * entry.attempts);
    entry.reconnectTimer = setTimeout(() => connect(entry).catch(error => log.error("jadibot", entry.id, error)), delay);
}

async function handleOpen(entry, sock) {
    const number = jidUser(sock.botJid);
    const lidNumber = jidUser(sock.botLid);
    const record = db.jadibot.getSession(entry.id);
    const duplicate = [...sessions.values()].find(item => item !== entry && item.number === number);

    if (db.jadibot.isBanned(number)) {
        await destroy(entry, { remove: true, reason: "Nombor ini dilarang menggunakan jadibot." });
        return;
    }
    if (duplicate) {
        await destroy(entry, { remove: true, reason: "Nombor ini sudah mempunyai jadibot aktif." });
        return;
    }

    clearTimeout(entry.pendingTimer);
    entry.pendingTimer = null;
    entry.status = "connected";
    entry.number = number;
    entry.qr = "";
    entry.pairingCode = "";
    entry.attempts = 0;

    if (record) {
        record.owners = unique([...(record.requesterParts ?? []), ...(record.owners ?? []), number, lidNumber]);
        db.jadibot.saveSession(entry.id, {
            number,
            lidNumber,
            waName: sock.user?.name ?? "",
            status: "connected",
            lastConnectedAt: Date.now()
        });
    }
    log.success("jadibot", `Jadibot aktif: ${record?.name ?? entry.id} (+${number})`);
    await notify(entry, "onOpen", describe(entry.id));
}

async function handleClose(entry, sock, info) {
    if (entry.stopping || entry.sock !== sock) return;
    log.warn("jadibot", `Sesi ${entry.id} ditutup: ${info.reason}`);

    if (info.permanent) {
        await destroy(entry, { remove: true, reason: info.reason });
        return;
    }
    if (!isLinked(sock) && !info.restartRequired) {
        await destroy(entry, { remove: true, reason: "Pemautan tidak selesai atau tamat masa." });
        return;
    }
    scheduleReconnect(entry);
}

async function connect(entry) {
    if (entry.stopping) return;

    const sock = await makeSocket({ sessionPath: sessionDir(entry.id), role: "jadibot", number: entry.id });
    sock.jadibotId = entry.id;
    entry.sock = sock;
    registerEvents(sock);

    bindConnection(sock, {
        pairingNumber: entry.method === "pairing" ? cleanNumber(entry.pairNumber) : "",
        onQr: async qr => {
            if (entry.method === "session") {
                await destroy(entry, { remove: true, reason: "Sesi tidak sah. Sila pautkan semula." });
                return;
            }
            entry.qr = qr;
            entry.status = "waiting";
            await notify(entry, "onQr", qr);
        },
        onPairing: async code => {
            entry.pairingCode = code;
            entry.status = "waiting";
            await notify(entry, "onPairing", code);
        },
        onPairingError: async error => {
            log.error("jadibot", `Gagal kod pairing ${entry.id}`, error);
            await notify(entry, "onError", error);
        },
        onOpen: () => handleOpen(entry, sock),
        onClose: info => handleClose(entry, sock, info)
    });
}

async function launch(id, method, hooks = {}) {
    const existing = sessions.get(id);
    if (existing) return existing;
    const record = db.jadibot.getSession(id);
    const entry = {
        id,
        method,
        pairNumber: record?.pairNumber ?? "",
        hooks,
        status: "starting",
        number: record?.number ?? "",
        qr: "",
        pairingCode: "",
        attempts: 0,
        startedAt: Date.now(),
        sock: null,
        stopping: false,
        pendingTimer: null,
        reconnectTimer: null
    };
    sessions.set(id, entry);

    if (method !== "session") {
        entry.pendingTimer = setTimeout(() => {
            if (entry.status !== "connected") destroy(entry, { remove: true, reason: "Masa pemautan tamat. Sila cuba lagi." });
        }, config.jadibot.pairTimeoutMs);
    }

    try {
        await connect(entry);
    } catch (error) {
        await destroy(entry, { remove: true, reason: "Gagal memulakan sesi." });
        throw error;
    }
    return entry;
}

export async function createSession({
    name,
    method = "pairing",
    pairNumber = "",
    requesterParts = [],
    ownerKey = "",
    ownerNumber = "",
    accountEmail = "",
    source = "whatsapp",
    isOwner = false,
    isPremium = false,
    hooks = {}
}) {
    const cleanName = String(name ?? "").trim();
    if (cleanName.length < 3 || cleanName.length > 25) throw new UserError("Nama bot mesti 3 hingga 25 aksara.");
    const number = cleanNumber(pairNumber);
    if (method === "pairing" && !/^\d{8,15}$/.test(number)) throw new UserError("Nombor pairing tidak sah. Guna format 60123456789.");

    const check = canCreate({ ownerKey, numbers: [number, ...requesterParts], isOwner, isPremium });
    if (!check.ok) throw new UserError(check.message);
    if (number && [...sessions.values(), ...db.jadibot.listSessions()].some(item => item.number === number || item.pairNumber === number)) {
        throw new UserError("Nombor ini sudah mempunyai jadibot.");
    }

    const id = makeSessionId(cleanName);
    const parts = unique(requesterParts.map(cleanNumber));
    db.jadibot.saveSession(id, {
        name: cleanName,
        method,
        pairNumber: number,
        number: "",
        requesterParts: parts,
        owners: unique([...parts, number]),
        ownerKey,
        ownerNumber,
        accountEmail: String(accountEmail).toLowerCase(),
        source,
        status: "pending",
        settings: structuredClone(config.jadibot.defaults)
    });

    try {
        await launch(id, method, hooks);
    } catch (error) {
        db.jadibot.removeSession(id);
        throw error;
    }
    return describe(id);
}

export async function killSession(query, { reason = "Dihentikan.", onlyIds } = {}) {
    const record = resolveSession(query, { onlyIds });
    const entry = sessions.get(record.id);
    if (entry) await destroy(entry, { remove: true, reason });
    else {
        fs.rmSync(sessionDir(record.id), { recursive: true, force: true });
        db.jadibot.removeSession(record.id);
    }
    return record;
}

export async function restartSession(query, { onlyIds } = {}) {
    const record = resolveSession(query, { onlyIds });
    const entry = sessions.get(record.id);
    if (entry) await destroy(entry, { remove: false, reason: "Dimulakan semula.", keepRecord: true, silent: true });
    if (!fs.existsSync(path.join(sessionDir(record.id), "creds.json"))) throw new UserError("Sesi belum dipautkan, tiada apa yang boleh dimulakan semula.");
    await launch(record.id, "session");
    return record;
}

export async function restartAll() {
    const ids = [...sessions.keys()];
    for (const id of ids) {
        await restartSession(id).catch(error => log.error("jadibot", `Gagal restart ${id}`, error));
        await sleep(1500);
    }
    return ids.length;
}

export async function deleteByAccount(email) {
    const records = db.jadibot.listByEmail(email);
    for (const record of records) await killSession(record.id, { reason: "Akaun web dipadam." }).catch(() => null);
    return records.length;
}

export async function banNumber(number, reason, by) {
    const digits = cleanNumber(number);
    db.jadibot.banNumber(digits, reason, by);
    const targets = db.jadibot.listSessions().filter(item => item.number === digits || item.pairNumber === digits || (item.requesterParts ?? []).includes(digits));
    for (const item of targets) await killSession(item.id, { reason: `Dilarang: ${reason}` }).catch(() => null);
    return targets.length;
}

export async function restoreSessions() {
    if (!config.jadibot.restoreOnStart) return 0;
    let restored = 0;
    for (const record of db.jadibot.listSessions()) {
        const hasCreds = fs.existsSync(path.join(sessionDir(record.id), "creds.json"));
        const banned = db.jadibot.isBanned(record.number) || (record.requesterParts ?? []).some(part => db.jadibot.isBanned(part));
        if (!hasCreds || banned || record.status === "stopped") continue;
        if (sessions.size >= config.jadibot.maxActive) break;
        try {
            await launch(record.id, "session");
            restored++;
        } catch (error) {
            log.error("jadibot", `Gagal memulihkan ${record.id}`, error);
        }
        await sleep(2000);
    }
    if (restored) log.success("jadibot", `${restored} sesi jadibot dipulihkan.`);
    return restored;
}

export async function stopAll() {
    for (const entry of [...sessions.values()]) {
        await destroy(entry, { remove: false, reason: "Bot dimatikan.", keepRecord: true, silent: true });
    }
}

global.jadibot = {
    sessionDir,
    isValidId,
    getPlaceholders,
    makeSessionId,
    getSession,
    getRecord,
    countActive,
    describe,
    listAll,
    resolveSession,
    canCreate,
    sanitizeSettings,
    updateSettings,
    resetMessages,
    setOwner,
    createSession,
    killSession,
    restartSession,
    restartAll,
    deleteByAccount,
    banNumber,
    restoreSessions,
    stopAll
};
