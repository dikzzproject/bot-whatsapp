const cooldowns = new Map();

const render = (template, ctx) => renderTemplate(template, ctx.vars);
const deny = (ctx, key, silent = false) => ({
    ok: false,
    silent,
    message: key ? render(ctx.messages[key], ctx) : "",
    mentions: [ctx.m.sender]
});

export function buildUsage(plugin, ctx) {
    const base = plugin.help[0] ?? plugin.name;
    const usage = plugin.usage || (plugin.customPrefix ? base : `${ctx.usedPrefix || ctx.prefixes[0]}${base}`);
    const example = plugin.example ? `\nContoh: ${plugin.example.replace("{prefix}", ctx.usedPrefix || ctx.prefixes[0])}` : "";
    return `ℹ️ Cara guna: ${usage}${example}`;
}

function usageRow(ctx) {
    const usage = ctx.bot.holder.usage;
    const date = today();
    const row = usage[ctx.m.userId];
    if (!row || row.date !== date) usage[ctx.m.userId] = { date, used: 0 };
    return usage[ctx.m.userId];
}

export function checkAccess(plugin, ctx) {
    const { sock, m, user, group } = ctx;

    if (plugin.disabled) return deny(ctx, "maintenance");
    if (plugin.official && sock.isJadibot) return deny(ctx, "officialOnly");
    if (sock.isJadibot && config.jadibot.blockedCommands.includes(ctx.command)) return deny(ctx, "jadibotBlocked");
    if (plugin.owner && !ctx.isOwner) return deny(ctx, "ownerOnly");
    if (plugin.botOwner && !ctx.isBotOwner) return deny(ctx, "ownerOnly");

    if (plugin.blacklist && (db.settings.blacklist.includes(m.chat) || db.settings.blacklist.includes(m.userId))) {
        return deny(ctx, "blacklisted");
    }

    if (plugin.group && !m.isGroup) return deny(ctx, "groupOnly");
    if (plugin.private && m.isGroup) return deny(ctx, "privateOnly");
    if (m.isGroup && group.mute && !ctx.isAdmin && !ctx.isOwner) return deny(ctx, null, true);

    if (plugin.register && !user.registered && !ctx.isOwner) return deny(ctx, "registerFirst");
    if (plugin.premium && !ctx.isPremium && !ctx.isOwner) return deny(ctx, "premiumOnly");
    if (plugin.admin && !ctx.isAdmin && !ctx.isOwner) return deny(ctx, "adminOnly");
    if (plugin.botAdmin && !ctx.isBotAdmin) return deny(ctx, "botAdminOnly");

    if (plugin.limit && !ctx.isPremium && !ctx.isOwner && user.limit < plugin.limit) return deny(ctx, "noLimit");

    const daily = ctx.bot.limit?.daily ?? 0;
    if (daily > 0 && !ctx.isBotOwner && !ctx.isPremium && usageRow(ctx).used >= daily) {
        ctx.vars.limit = daily;
        return deny(ctx, "dailyLimit");
    }

    if (plugin.cooldown && !ctx.isOwner) {
        const until = cooldowns.get(`${m.userId}:${plugin.id}`) ?? 0;
        if (until > Date.now()) {
            ctx.vars.time = formatDuration(until - Date.now());
            return deny(ctx, "cooldown");
        }
    }

    if (plugin.needText && !ctx.text) {
        return {
            ok: false,
            message: typeof plugin.needText === "string" ? plugin.needText : buildUsage(plugin, ctx),
            mentions: []
        };
    }

    if (plugin.media.length) {
        const source = m.mediaSource;
        const allowed = source && (plugin.media.includes("any") || plugin.media.includes(source.mediaType));
        if (!allowed) {
            ctx.vars.types = plugin.media.join(", ");
            return deny(ctx, "needMedia");
        }
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
    if ((ctx.bot.limit?.daily ?? 0) > 0 && !ctx.isBotOwner && !ctx.isPremium) usageRow(ctx).used += 1;
}
