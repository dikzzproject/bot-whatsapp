import db from "#database";
import log from "#logger";
import serialize from "#client/serialize.js";
import buildContext from "#lib/context.js";
import { UserError } from "#lib/errors.js";
import { addExp } from "#lib/economy.js";
import { getBeforeHooks } from "#lib/plugins.js";
import { handle as handleWizard } from "#lib/wizard.js";
import { checkAccess, markUsed } from "#lib/permissions.js";
import handleStatus from "./status.js";

const MIN_OLD_MESSAGE_SEC = 30;

const isOutdated = m =>
    Date.now() / 1000 - m.timestamp >
    Math.max(db.settings.ignoreOldMessageSec, MIN_OLD_MESSAGE_SEC);

function trackActivity(ctx) {
    const { m, group, user } = ctx;
    addExp(user, 1);
    if (group) group.stats[m.userId] = (group.stats[m.userId] ?? 0) + 1;
}

async function runBeforeHooks(ctx) {
    for (const plugin of getBeforeHooks()) {
        try {
            if (plugin.before && (await plugin.before(ctx.m, ctx)) === true) {
                return true;
            }
        } catch (error) {
            log.error(
                "before",
                `Error on hook "${plugin.name || "unknown"}"`,
                error
            );
        }
    }
    return false;
}

async function runPlugin(plugin, ctx) {
    const { sock, m } = ctx;
    const verdict = checkAccess(plugin, ctx);
    if (!verdict.ok) {
        if (!verdict.silent && verdict.message)
            await m.reply(verdict.message, {
                mentions: verdict.mentions ?? []
            });
        return;
    }

    if (plugin.loading)
        await m.reply(renderTemplate(ctx.messages.loading, ctx.vars), {
            mentions: [m.sender]
        });
    if (plugin.react) await m.react(plugin.react).catch(() => null);

    log.cmd(
        "command",
        `${m.name} (${m.number}) › ${ctx.prefix}${ctx.command}`,
        m.isGroup ? m.chat : "private chat"
    );
    if (db.settings.autoTyping)
        sock.sendPresenceUpdate("composing", m.chat).catch(() => null);

    try {
        const result = await plugin.exec(m, ctx);
        if (result !== false) markUsed(plugin, ctx);
    } catch (error) {
        if (error instanceof UserError) return m.reply(error.message);
        log.error("command", `Error in command "${ctx.command}"`, error);
        await m.reply(renderTemplate(ctx.messages.error, ctx.vars), {
            mentions: [m.sender]
        });
    }
}

async function processMessage(sock, message) {
    if (!message?.message) return;
    const jid = message.key.remoteJid;
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
    log.debug(
        "messages",
        `${m.name} (${m.userId}) of ${m.chat}: ${m.text.slice(0, 80)}`,
        `command="${ctx.command}" owner=${ctx.isOwner} botOwner=${ctx.isBotOwner}`
    );
    if (ctx.user.banned && !ctx.isOwner) return;
    if (ctx.bot.mode === "self" && !ctx.isBotOwner) return;

    trackActivity(ctx);
    if (await handleWizard(m, ctx)) return;
    if (await runBeforeHooks(ctx)) return;
    if (ctx.plugin?.exec) await runPlugin(ctx.plugin, ctx);
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
