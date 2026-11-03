import fs from "node:fs";
import path from "node:path";
import config from "#config/global.js";

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const pickRandom = list => list[Math.floor(Math.random() * list.length)];

export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const toArray = value =>
    value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];

export const isPlainObject = value =>
    value !== null && typeof value === "object" && !Array.isArray(value);

export const ensureDir = dir => {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

export const tempPath = (ext = "tmp") =>
    path.join(ensureDir(config.paths.tmp), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);

export const removeFile = file => {
    try {
        fs.rmSync(file, { force: true });
    } catch {
        return;
    }
};

export const isUrl = text => /^https?:\/\/\S+$/i.test(String(text || "").trim());

export const formatNumber = value => new Intl.NumberFormat("ms-MY").format(Math.floor(Number(value) || 0));

export const formatBytes = bytes => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = Number(bytes) || 0;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index++;
    }
    return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

export const formatDuration = ms => {
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

export const cleanNumber = value => String(value ?? "").replace(/\D/g, "");

export const jidUser = jid => String(jid ?? "").split("@")[0].split(":")[0];

export const isGroupJid = jid => String(jid ?? "").endsWith("@g.us");

export const isLidJid = jid => String(jid ?? "").endsWith("@lid");

export const toUserJid = number => `${cleanNumber(number)}@s.whatsapp.net`;

export const canonicalId = (...ids) =>
    ids.find(id => id?.endsWith("@s.whatsapp.net")) ?? ids.find(Boolean) ?? "";

export const mentionTag = jid => `@${jidUser(jid)}`;

export function deepDefaults(target, defaults) {
    for (const [key, value] of Object.entries(defaults)) {
        if (target[key] === undefined) target[key] = structuredClone(value);
        else if (isPlainObject(value) && isPlainObject(target[key])) deepDefaults(target[key], value);
    }
    return target;
}

export const today = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: config.bot.timezone });
