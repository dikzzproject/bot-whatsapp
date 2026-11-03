import config from "#config/global.js";
import db from "#database";
import { getCategories } from "./plugins.js";
import { formatDuration, formatNumber } from "./utils.js";

const ICON_ORDER = ["limit", "premium", "owner"];

const flags = plugin =>
    ICON_ORDER.filter(key => plugin[key])
        .map(key => config.menu.icons[key])
        .join("");

export function buildHeader(ctx) {
    const { user, m } = ctx;
    return [
        `╭─❖ *${config.bot.name}* v${config.bot.version}`,
        `│ 👤 User : ${user.registered ? user.name : m.name}`,
        `│ 🏅 Level    : ${user.level}`,
        `│ 🔋 Limit    : ${ctx.isPremium || ctx.isOwner ? "∞" : formatNumber(user.limit)}`,
        `│ 💰 Wang     : ${formatNumber(user.money)}`,
        `│ ⏱️ Uptime   : ${formatDuration(process.uptime() * 1000)}`,
        `│ 👥 Users : ${db.users.size} didaftar`,
        "╰──────────────❖"
    ].join("\n");
}

const formatCategory = (name, plugins, prefix) => {
    const lines = plugins.flatMap(plugin => plugin.help.map(item => `│ ◦ ${prefix}${item}${flags(plugin)}`));
    return `┌─「 ${name.toUpperCase()} 」\n${lines.join("\n")}\n└──────────────`;
};

export function buildOverview(prefix) {
    const rows = [...getCategories()].map(
        ([name, plugins]) => `│ ◦ ${prefix}menu ${name} (${plugins.length})`
    );
    return [
        "┌─「 KATEGORI 」",
        ...rows,
        `│ ◦ ${prefix}allmenu`,
        "└──────────────",
        "",
        `${config.menu.icons.limit} limit  ${config.menu.icons.premium} premium  ${config.menu.icons.owner} owner`
    ].join("\n");
}

export function buildCategory(name, prefix) {
    const plugins = getCategories().get(name.toLowerCase());
    return plugins ? formatCategory(name, plugins, prefix) : null;
}

export const buildAll = prefix =>
    [...getCategories()].map(([name, plugins]) => formatCategory(name, plugins, prefix)).join("\n\n");
