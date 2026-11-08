import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import util from "node:util";
import childProcess from "node:child_process";
import nodeCrypto from "node:crypto";
import axios from "axios";
import QRCode from "qrcode";

class UserError extends Error {
    constructor(message) {
        super(message);
        this.name = "UserError";
    }
}

class TTLCache {
    constructor({ ttl = 60 * 60 * 1000, max = 500 } = {}) {
        this.ttl = ttl;
        this.max = max;
        this.store = new Map();
    }

    set(key, value, ttl = this.ttl) {
        if (this.store.size >= this.max) this.store.delete(this.store.keys().next().value);
        this.store.set(key, { value, expires: Date.now() + ttl });
        return value;
    }

    get(key) {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (entry.expires < Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    has(key) {
        return this.get(key) !== undefined;
    }

    delete(key) {
        return this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }
}

class SessionStore {
    constructor({ ttl = 120000 } = {}) {
        this.ttl = ttl;
        this.sessions = new Map();
    }

    start(key, data, { ttl = this.ttl, onExpire } = {}) {
        this.end(key);
        const timer = setTimeout(() => {
            const session = this.sessions.get(key);
            this.sessions.delete(key);
            if (session) onExpire?.(session);
        }, ttl);
        timer.unref?.();
        const session = { ...data, timer, startedAt: Date.now() };
        this.sessions.set(key, session);
        return session;
    }

    get(key) {
        return this.sessions.get(key) ?? null;
    }

    has(key) {
        return this.sessions.has(key);
    }

    end(key) {
        const session = this.sessions.get(key);
        if (session) clearTimeout(session.timer);
        this.sessions.delete(key);
        return session ?? null;
    }
}

const toArray = value =>
    value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];

const ensureDir = dir => {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const cleanNumber = value => String(value ?? "").replace(/\D/g, "");
const jidUser = jid => String(jid ?? "").split("@")[0].split(":")[0];
const isLidJid = jid => String(jid ?? "").endsWith("@lid");
const isPnJid = jid => String(jid ?? "").endsWith("@s.whatsapp.net");

const formatDuration = ms => {
    let seconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;
    const parts = [];
    if (days) parts.push(`${days} hari`);
    if (hours) parts.push(`${hours} jam`);
    if (minutes) parts.push(`${minutes} min`);
    if (seconds || !parts.length) parts.push(`${seconds} saat`);
    return parts.join(" ");
};

const formatBytes = bytes => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = Number(bytes) || 0;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index++;
    }
    return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

const timeZone = () => global.config.bot.timezone;

const helpers = {
    fs,
    os,
    path,
    util,
    childProcess,
    nodeCrypto,
    axios,
    QRCode,
    UserError,
    TTLCache,
    SessionStore,
    toArray,
    unique: list => [...new Set(toArray(list).filter(Boolean))],
    ensureDir,
    cleanNumber,
    jidUser,
    isLidJid,
    isPnJid,
    formatDuration,
    formatBytes,

    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    pickRandom: list => list[Math.floor(Math.random() * list.length)],
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    isPlainObject: value => value !== null && typeof value === "object" && !Array.isArray(value),
    isUrl: text => /^https?:\/\/\S+$/i.test(String(text || "").trim()),
    isEmail: text => /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(String(text || "").trim()) && String(text).length <= 120,
    formatNumber: value => new Intl.NumberFormat("ms-MY").format(Math.floor(Number(value) || 0)),
    shorten: (text, max = 100) => (String(text).length > max ? `${String(text).slice(0, max - 1)}…` : String(text)),
    slugify: text =>
        String(text ?? "")
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, ""),
    randomString: (length = 10, alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789") =>
        Array.from(nodeCrypto.randomBytes(length), byte => alphabet[byte % alphabet.length]).join(""),

    tempPath: (ext = "tmp") =>
        path.join(ensureDir(global.config.paths.tmp), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`),
    removeFile: file => {
        try {
            fs.rmSync(file, { force: true });
        } catch {
            return;
        }
    },

    toUserJid: number => `${cleanNumber(number)}@s.whatsapp.net`,
    toUserLid: number => `${cleanNumber(number)}@s.whatsapp.net`,
    toLidJid: number => `${cleanNumber(number)}@lid`,
    isGroupJid: jid => String(jid ?? "").endsWith("@g.us"),
    canonicalId: (...ids) =>
        ids.find(id => isLidJid(id)) ?? ids.find(id => isPnJid(id)) ?? ids.find(Boolean) ?? "",
    mentionTag: jid => `@${jidUser(jid)}`,

    deepDefaults(target, defaults) {
        for (const [key, value] of Object.entries(defaults)) {
            if (target[key] === undefined) target[key] = structuredClone(value);
            else if (helpers.isPlainObject(value) && helpers.isPlainObject(target[key])) helpers.deepDefaults(target[key], value);
        }
        return target;
    },

    today: () => new Date().toLocaleDateString("en-CA", { timeZone: timeZone() }),

    renderTemplate: (text, vars = {}) =>
        String(text ?? "").replace(/\{(\w+)\}/g, (match, key) => (vars[key] === undefined ? match : String(vars[key]))),

    templateVars: ctx => {
        const m = ctx.m;
        const now = new Date();
        return {
            prefix: ctx.usedPrefix || ctx.prefixes?.[0] || ".",
            group: ctx.metadata?.subject || ctx.group?.name || "peribadi",
            sender: `@${jidUser(m.sender)}`,
            user: ctx.user?.registered ? ctx.user.name : m.name,
            number: m.number,
            time: now.toLocaleTimeString("ms-MY", { timeZone: timeZone(), hour12: false }),
            date: now.toLocaleDateString("ms-MY", { timeZone: timeZone() }),
            botname: ctx.bot?.name || global.config.bot.name,
            command: ctx.command || "",
            limit: ctx.user?.limit ?? 0,
            cost: ctx.plugin?.limit ?? 0
        };
    },

    fetchJson: async (url, { params, headers, timeout = 20000, method = "get", data } = {}) => {
        const response = await axios({
            url,
            method,
            params,
            data,
            timeout,
            headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36", ...headers }
        });
        return response.data;
    },

    fetchBuffer: async (url, { headers, timeout = 60000 } = {}) => {
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout,
            maxContentLength: 100 * 1024 * 1024,
            headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36", ...headers }
        });
        return Buffer.from(response.data);
    }
};

Object.assign(globalThis, helpers);
