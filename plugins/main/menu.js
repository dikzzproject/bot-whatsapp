const CATEGORY_ORDER = [
    "main",
    "info",
    "xp",
    "ai",
    "internet",
    "downloader",
    "search",
    "tools",
    "fun",
    "game",
    "rpg",
    "group",
    "settings",
    "jadibot",
    "owner"
];

const CAPTION_LIMIT = 1000;

const orderOf = tag => {
    const index = CATEGORY_ORDER.indexOf(tag);
    return index === -1 ? CATEGORY_ORDER.length : index;
};

const canSee = (plugin, { conn, isDeveloper, isBotOwner }) => {
    if (!plugin || plugin.disabled || plugin.hidden || !plugin.exec) return false;
    if (!plugin.help?.length || !plugin.tags?.length) return false;
    if (plugin.official && conn.isJadibot) return false;
    if (plugin.owner && !isDeveloper) return false;
    if (plugin.botOwner && !isBotOwner) return false;
    return true;
};

const flags = plugin =>
    [plugin.limit ? lolm : "", plugin.premium ? loprm : "", plugin.owner || plugin.botOwner ? lopr : ""]
        .filter(Boolean)
        .join("");

function collectGroups(ctx) {
    const groups = {};
    for (const name in global.plugins) {
        const plugin = global.plugins[name];
        if (!canSee(plugin, ctx)) continue;

        for (const tag of plugin.tags) {
            if (!tag) continue;
            groups[tag] ??= [];
            for (const help of plugin.help) {
                if (typeof help !== "string") continue;
                const line = `│ ◦ ${plugin.customPrefix ? "" : ctx.usedPrefix}${help}${flags(plugin)}`;
                if (!groups[tag].includes(line)) groups[tag].push(line);
            }
        }
    }
    return groups;
}

function buildHeader(ctx) {
    const { user, m, bot } = ctx;
    return [
        `╭─❖ *${bot.name}* v${config.bot.version}`,
        `│ 👤 User : ${user.registered ? user.name : m.name}`,
        `│ 🏅 Level    : ${user.level}`,
        `│ 🔋 Limit    : ${ctx.isPremium || ctx.isOwner ? "∞" : formatNumber(user.limit)}`,
        `│ 💰 Wang     : ${formatNumber(user.money)}`,
        `│ ⏱️ Uptime   : ${formatDuration(process.uptime() * 1000)}`,
        `│ 👥 Users : ${db.users.size} didaftar`,
        "╰──────────────❖",
        "",
        renderTemplate(ctx.messages.botMessage, ctx.vars)
    ].join("\n");
}

const formatCategory = (name, lines) => `┌─「 ${name.toUpperCase()} 」\n${lines.join("\n")}\n└──────────────`;

const legend = () => `${lolm} limit  ${loprm} premium  ${lopr} owner`;

async function sendMenu(m, ctx, header, body) {
    const image = randomImage();
    const full = `${header}\n\n${body}`;

    if (!image) return m.reply(full, { mentions: [m.sender] });
    if (full.length <= CAPTION_LIMIT) {
        return ctx.conn.sendMessage(m.chat, { image, caption: full, mentions: [m.sender] }, { quoted: m });
    }

    await ctx.conn.sendMessage(m.chat, { image, caption: header, mentions: [m.sender] }, { quoted: m });
    return m.reply(body, { mentions: [m.sender] });
}

export default {
    name: "main-menu",
    command: ["menu", "allmenu", "help"],
    tags: ["main"],
    help: ["menu", "menu <category>", "allmenu"],

    run: async (m, ctx) => {
        const { usedPrefix, command, text } = ctx;
        await m.react("🍃");

        const groups = collectGroups(ctx);
        const sortedTags = Object.keys(groups).sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b));
        const header = buildHeader(ctx);
        const input = text.toLowerCase().trim().split(/\s+/)[0];

        if (command === "allmenu" || input === "all") {
            return sendMenu(m, ctx, header, `${sortedTags.map(tag => formatCategory(tag, groups[tag])).join("\n\n")}\n\n${legend()}`);
        }

        if (input && groups[input]) return sendMenu(m, ctx, header, `${formatCategory(input, groups[input])}\n\n${legend()}`);

        const rows = sortedTags.map(tag => `│ ◦ ${usedPrefix}menu ${tag} (${groups[tag].length})`);
        return sendMenu(m, ctx, header, `${formatCategory("KATEGORI", [...rows, `│ ◦ ${usedPrefix}allmenu`])}\n\n${legend()}`);
    }
};
