import { formatDuration } from "#lib/utils.js";
import db from "#database";

export default {
    command: ["afk"],
    help: ["afk [alasan]"],
    tags: ["main"],
    description: "Tandakan anda sedang tiada",

    before: async (m, ctx) => {
        const { user } = ctx;

        if (user.afk.since && !ctx.command?.startsWith("afk")) {
            const duration = formatDuration(Date.now() - user.afk.since);
            user.afk = { since: 0, reason: "" };
            await m.reply(`👋 Selamat kembali ${m.name}! Anda AFK selama ${duration}.`);
        }

        const targets = [...(m.mentionedJid || []), m.quoted?.sender].filter(Boolean);
        for (const jid of targets) {
            const record = db.users.find(jid);
            if (record?.afk?.since) {
                await m.reply(
                    `💤 Pengguna itu sedang AFK sejak ${formatDuration(Date.now() - record.afk.since)}.\nSebab: ${record.afk.reason || "Tiada sebab"}`
                );
                break;
            }
        }
        return false;
    },

    exec: async (m, { user, text }) => {
        user.afk = { since: Date.now(), reason: text || "Tiada sebab" };
        return m.reply(`💤 ${m.name} kini AFK.\nSebab: ${user.afk.reason}`);
    }
};
