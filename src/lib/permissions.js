import config from "#config/global.js";
import db from "#database";
import { formatDuration } from "./utils.js";

const cooldowns = new Map();

const deny = (message, silent = false) => ({ ok: false, message, silent });
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

export function buildUsage(plugin, ctx) {
    const usage = plugin.usage || `${ctx.prefix}${plugin.help[0] ?? plugin.name}`;
    const example = plugin.example ? `\nContoh: ${plugin.example.replace("{prefix}", ctx.prefix)}` : "";
    return `ℹ️ Cara guna: ${usage}${example}`;
}

export function checkAccess(plugin, ctx) {
    const { sock, m, user, group } = ctx;
    const text = config.messages;

    if (plugin.disabled) return deny(text.maintenance);
    if (plugin.official && sock.isJadibot) return deny(text.officialOnly);
    if (sock.isJadibot && config.jadibot.blockedCommands.includes(ctx.command)) return deny(text.jadibotBlocked);
    if (plugin.owner && !ctx.isOwner) return deny(text.ownerOnly);

    if (plugin.blacklist && (db.settings.blacklist.includes(m.chat) || db.settings.blacklist.includes(m.userId))) {
        return deny(text.blacklisted);
    }

    if (plugin.group && !m.isGroup) return deny(text.groupOnly);
    if (plugin.private && m.isGroup) return deny(text.privateOnly);
    if (m.isGroup && group.mute && !ctx.isAdmin && !ctx.isOwner) return deny("", true);

    if (plugin.register && !user.registered && !ctx.isOwner) {
        return deny(fill(text.registerFirst, { prefix: ctx.prefix }));
    }
    if (plugin.premium && !ctx.isPremium && !ctx.isOwner) return deny(text.premiumOnly);
    if (plugin.admin && !ctx.isAdmin && !ctx.isOwner) return deny(text.adminOnly);
    if (plugin.botAdmin && !ctx.isBotAdmin) return deny(text.botAdminOnly);

    if (plugin.limit && !ctx.isPremium && !ctx.isOwner && user.limit < plugin.limit) {
        return deny(fill(text.noLimit, { cost: plugin.limit }));
    }

    if (plugin.cooldown && !ctx.isOwner) {
        const until = cooldowns.get(`${m.userId}:${plugin.id}`) ?? 0;
        if (until > Date.now()) {
            return deny(fill(text.cooldown, { time: formatDuration(until - Date.now()) }));
        }
    }

    if (plugin.needText && !ctx.text) {
        return deny(typeof plugin.needText === "string" ? plugin.needText : buildUsage(plugin, ctx));
    }

    if (plugin.media.length) {
        const source = m.mediaSource;
        const allowed = source && (plugin.media.includes("any") || plugin.media.includes(source.mediaType));
        if (!allowed) return deny(fill(text.needMedia, { types: plugin.media.join(", ") }));
    }

    return { ok: true };
}

export function markUsed(plugin, ctx) {
    const { user, m } = ctx;
    user.commandCount += 1;
    if (plugin.cooldown && !ctx.isOwner) {
        cooldowns.set(`${m.userId}:${plugin.id}`, Date.now() + plugin.cooldown * 1000);
    }
    if (plugin.limit && !ctx.isPremium && !ctx.isOwner) user.limit -= plugin.limit;
}
