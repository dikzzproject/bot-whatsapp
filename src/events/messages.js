import config from "#config/global.js";
import db from "#database";
import log from "#logger";
import serialize from "#client/serialize.js";
import buildContext from "#lib/context.js";
import { UserError } from "#lib/errors.js";
import { addExp } from "#lib/economy.js";
import { findCommand, getBeforeHooks } from "#lib/plugins.js";
import { checkAccess, markUsed } from "#lib/permissions.js";
import handleStatus from "./status.js";

const MIN_OLD_MESSAGE_SEC = 30;

const isOutdated = m =>
    Date.now() / 1000 - m.timestamp > Math.max(db.settings.ignoreOldMessageSec, MIN_OLD_MESSAGE_SEC);

function trackActivity(ctx) {
    const { m, group, user } = ctx;
    addExp(user, 1);
    if (group) group.stats[m.number] = (group.stats[m.number] ?? 0) + 1;
}

async function runBeforeHooks(ctx) {
    for (const plugin of getBeforeHooks()) {
        try {
            if (plugin.before && (await plugin.before(ctx.m, ctx)) === true) {
                return true;
            }
        } catch (error) {
            log.error("before", `Error on hook "${plugin.name || 'unknown'}"`, error);
        }
    }
    return false;
}


async function runPlugin(plugin, ctx) {
    const { sock, m } = ctx;
    const verdict = checkAccess(plugin, ctx);
    if (!verdict.ok) {
        if (!verdict.silent && verdict.message) await m.reply(verdict.message);
        return;
    }

    log.cmd("command", `${m.name} (${m.number}) › ${ctx.prefix}${ctx.command}`,
    m.isGroup ? m.chat : "private chat");
    if (db.settings.autoTyping) sock.sendPresenceUpdate("composing", m.chat).catch(() => null);

    try {
        const result = await plugin.exec(m, ctx);
        if (result !== false) markUsed(plugin, ctx);
    } catch (error) {
        if (error instanceof UserError) return m.reply(error.message);
        log.error("command", `Error in command "${ctx.command}"`, error);
        await m.reply(config.messages.error);
    }
}

async function processMessage(sock, message) {
    if (!message?.message) return;
    const jid = message.key.remoteJid;
    if (!jid || jid.endsWith("@newsletter") || (jid.endsWith("@broadcast") && jid !== "status@broadcast")) return;
    if (jid === "status@broadcast") return handleStatus(sock, message);

    sock.msgStore.set(message.key.id, message);
    const m = await serialize(sock, message);
    if (!m) return;
    if (m.fromMe && sock.sentIds.has(m.id)) return;
    if (isOutdated(m)) return;
    if (sock.isJadibot && db.jadibot.isChatBanned(m.chat)) return;

    db.refreshDaily();
    if (db.settings.autoRead) sock.readMessages([m.key]).catch(() => null);

    const ctx = await buildContext(sock, m);
    log.debug("messages", `${m.name} (${m.userId}) of ${m.chat}: ${m.text.slice(0, 80)}`, `command="${ctx.command}" owner=${ctx.isOwner}`);
    if (ctx.user.banned && !ctx.isOwner) return;
    if (db.settings.mode === "self" && !ctx.isOwner && !ctx.isSelf) return;

    trackActivity(ctx);
    if (await runBeforeHooks(ctx)) return;
    if (!ctx.command) return;

    const plugin = findCommand(ctx.command);
    if (plugin?.exec) await runPlugin(plugin, ctx);
}

export default async function onMessages(sock, { messages, type }) {
    if (type !== "notify") return;
    for (const message of messages) {
        try {
            await processMessage(sock, message);
        } catch (error) {
            log.error("messages", "Failed to process incoming message.", error);
        }
    }
}
