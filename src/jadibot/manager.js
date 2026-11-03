import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import config from "#config/global.js";
import db from "#database";
import log from "#logger";
import makeSocket from "#client/makeSocket.js";
import { bindConnection, isLinked } from "#client/connection.js";
import registerEvents from "#events/index.js";
import { registry } from "#lib/registry.js";
import { cleanNumber, jidUser, sleep } from "#lib/utils.js";

const sessions = registry.jadibots;
const ID_PATTERN = /^(\d{8,15}|qr-[a-f0-9]{12})$/;

export const sessionDir = id => path.join(config.paths.auth, "jadibot", id);
export const isValidId = id => ID_PATTERN.test(String(id));
export const normalizeId = value => {
    const text = String(value ?? "").trim().toLowerCase();
    return text.startsWith("qr-") ? text : cleanNumber(text);
};
export const createQrId = () => `qr-${crypto.randomBytes(6).toString("hex")}`;
export const createToken = () => crypto.randomBytes(16).toString("hex");

export const getSession = id => sessions.get(id) ?? null;
export const countActive = () => sessions.size;
export const findByOwner = owner => [...sessions.values()].filter(entry => entry.owner === owner);

export function publicInfo(entry) {
    return {
        id: entry.id,
        method: entry.method,
        status: entry.status,
        number: entry.number,
        name: entry.name,
        owner: entry.owner,
        source: entry.source,
        pairingCode: entry.pairingCode,
        hasQr: Boolean(entry.qr),
        startedAt: entry.startedAt
    };
}

export const listSessions = () => [...sessions.values()].map(publicInfo);

export function canStart({ owner, number = "", isOwner = false, isPremium = false }) {
    const rules = config.jadibot;
    if (!rules.enabled) return { ok: false, message: "Jadibot dimatikan buat masa ini." };
    if ([owner, number].some(value => value && db.jadibot.isBanned(value))) {
        return { ok: false, message: "🚫 Nombor ini dilarang menggunakan jadibot." };
    }
    if (!isOwner && !rules.free && !isPremium) {
        return { ok: false, message: "💎 Jadibot hanya untuk pengguna premium." };
    }
    if (countActive() >= rules.maxActive) return { ok: false, message: "Slot jadibot penuh. Cuba sebentar lagi." };
    if (!isOwner && owner && findByOwner(owner).length >= rules.maxPerUser) {
        return { ok: false, message: `Anda hanya boleh mempunyai ${rules.maxPerUser} jadibot aktif.` };
    }
    return { ok: true };
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
    entry.name = sock.user?.name ?? "";
    entry.qr = "";
    entry.pairingCode = "";
    entry.attempts = 0;

    db.jadibot.saveSession(entry.id, {
        owner: entry.owner,
        method: entry.method === "session" ? (db.jadibot.getSession(entry.id)?.method ?? "pairing") : entry.method,
        source: entry.source,
        number,
        name: entry.name,
        status: "connected",
        lastConnectedAt: Date.now()
    });
    log.success("jadibot", `Jadibot aktif: ${number} (sesi ${entry.id})`);
    await notify(entry, "onOpen", entry);
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

    const sock = await makeSocket({
        sessionPath: sessionDir(entry.id),
        role: "jadibot",
        number: entry.id
    });
    entry.sock = sock;
    registerEvents(sock);

    bindConnection(sock, {
        pairingNumber: entry.method === "pairing" ? cleanNumber(entry.id) : "",
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

export async function startSession({ id, method = "pairing", owner = "", source = "whatsapp", hooks = {} }) {
    if (!isValidId(id)) throw new Error("ID sesi tidak sah.");
    const existing = sessions.get(id);
    if (existing) return existing;

    const entry = {
        id,
        method,
        owner,
        source,
        hooks,
        token: createToken(),
        status: "starting",
        number: "",
        name: "",
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
            if (entry.status !== "connected") {
                destroy(entry, { remove: true, reason: "Masa pemautan tamat. Sila cuba lagi." });
            }
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

export async function stopSession(id, { remove = true, reason = "Dihentikan." } = {}) {
    const entry = sessions.get(id);
    if (!entry) return false;
    await destroy(entry, { remove, reason });
    return true;
}

export async function restartSession(id) {
    const entry = sessions.get(id);
    if (!entry) return false;
    const { method, owner, source, hooks } = entry;
    await destroy(entry, { remove: false, reason: "Dimulakan semula.", keepRecord: true, silent: true });
    await startSession({ id, method: "session", owner, source, hooks });
    return true;
}

export async function restartAll() {
    const ids = [...sessions.keys()];
    for (const id of ids) {
        await restartSession(id).catch(error => log.error("jadibot", `Gagal restart ${id}`, error));
        await sleep(1500);
    }
    return ids.length;
}

export async function banNumber(number, reason, by) {
    db.jadibot.banNumber(number, reason, by);
    const targets = [...sessions.values()].filter(
        entry => entry.number === cleanNumber(number) || entry.owner === cleanNumber(number)
    );
    for (const entry of targets) await destroy(entry, { remove: true, reason: `Dilarang: ${reason}` });
    return targets.length;
}

export async function restoreSessions() {
    if (!config.jadibot.restoreOnStart) return 0;
    let restored = 0;
    for (const record of db.jadibot.listSessions()) {
        const hasCreds = fs.existsSync(path.join(sessionDir(record.id), "creds.json"));
        const banned = db.jadibot.isBanned(record.number ?? record.id) || db.jadibot.isBanned(record.owner);
        if (!hasCreds || banned || record.status === "stopped") continue;
        if (countActive() >= config.jadibot.maxActive) break;
        try {
            await startSession({
                id: record.id,
                method: "session",
                owner: record.owner,
                source: record.source ?? "whatsapp"
            });
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
    for (const entry of [...sessions.values()]) await destroy(entry, { remove: false, reason: "Bot dimatikan.", keepRecord: true, silent: true });
}
