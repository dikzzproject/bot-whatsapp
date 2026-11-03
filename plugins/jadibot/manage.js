import db from "#database";
import { cleanNumber } from "#lib/utils.js";
import { banNumber, normalizeId, restartAll, restartSession, stopSession } from "#jadibot/manager.js";

const guard = { tags: ["jadibot"], owner: true, official: true };

export default [
    {
        ...guard,
        command: ["banjadibot"],
        help: ["banjadibot <nombor> [sebab]"],
        needText: true,
        exec: async (m, { args }) => {
            const number = cleanNumber(args[0]);
            if (number.length < 8) return m.reply("Nombor tidak sah.");
            const reason = args.slice(1).join(" ") || "Tiada sebab";
            const stopped = await banNumber(number, reason, m.number);
            return m.reply(`🚫 +${number} dilarang menggunakan jadibot.\nSesi dihentikan: ${stopped}`);
        }
    },
    {
        ...guard,
        command: ["unbanjadibot"],
        help: ["unbanjadibot <nombor>"],
        needText: true,
        exec: (m, { args }) => {
            const number = cleanNumber(args[0]);
            return m.reply(db.jadibot.unbanNumber(number) ? `✅ +${number} dibenarkan semula.` : "Nombor tidak berada dalam senarai larangan.");
        }
    },
    {
        ...guard,
        command: ["banchatjadibot"],
        help: ["banchatjadibot [idChat]"],
        exec: (m, { args }) => {
            const jid = args[0] || m.chat;
            db.jadibot.banChat(jid, args.slice(1).join(" ") || "Tiada sebab", m.number);
            return m.reply(`🚫 Chat ${jid} dilarang menggunakan jadibot.`);
        }
    },
    {
        ...guard,
        command: ["unbanchatjadibot"],
        help: ["unbanchatjadibot [idChat]"],
        exec: (m, { args }) => {
            const jid = args[0] || m.chat;
            return m.reply(db.jadibot.unbanChat(jid) ? `✅ Chat ${jid} dibenarkan semula.` : "Chat tidak berada dalam senarai larangan.");
        }
    },
    {
        ...guard,
        command: ["listbanjadibot"],
        help: ["listbanjadibot"],
        exec: m => {
            const rows = db.jadibot.listBannedNumbers();
            if (!rows.length) return m.reply("Tiada nombor dilarang.");
            return m.reply(`🚫 *Nombor Dilarang*\n${rows.map((r, i) => `${i + 1}. +${r.number} — ${r.reason}`).join("\n")}`);
        }
    },
    {
        ...guard,
        command: ["listbanchatjadibot"],
        help: ["listbanchatjadibot"],
        exec: m => {
            const rows = db.jadibot.listBannedChats();
            if (!rows.length) return m.reply("Tiada chat dilarang.");
            return m.reply(`🚫 *Chat Dilarang*\n${rows.map((r, i) => `${i + 1}. ${r.jid} — ${r.reason}`).join("\n")}`);
        }
    },
    {
        ...guard,
        command: ["restartjadibot"],
        help: ["restartjadibot <id|nombor>"],
        needText: true,
        exec: async (m, { args }) => {
            const ok = await restartSession(normalizeId(args[0]));
            return m.reply(ok ? "🔄 Jadibot dimulakan semula." : "Sesi tidak dijumpai.");
        }
    },
    {
        ...guard,
        command: ["restartalljadibot"],
        help: ["restartalljadibot"],
        exec: async m => {
            const total = await restartAll();
            return m.reply(`🔄 ${total} jadibot dimulakan semula.`);
        }
    },
    {
        ...guard,
        command: ["killjadibot"],
        help: ["killjadibot <id|nombor>"],
        needText: true,
        exec: async (m, { args }) => {
            const ok = await stopSession(normalizeId(args[0]), { remove: true, reason: "Dihentikan oleh owner." });
            return m.reply(ok ? "✅ Jadibot dihentikan dan dipadam." : "Sesi tidak dijumpai.");
        }
    }
];
