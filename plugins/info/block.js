import { toUserJid } from "#lib/utils.js";

const resolveTarget = (m, text) => m.target || (text ? toUserJid(text) : "");

export default [
    {
        command: ["block"],
        help: ["block <@tag|nombor>"],
        tags: ["info"],
        owner: true,
        official: true,
        exec: async (m, { sock, text }) => {
            const target = resolveTarget(m, text);
            if (!target) return m.reply("Tag pengguna atau tulis nombor.");
            await sock.updateBlockStatus(target, "block");
            return m.reply("✅ Pengguna disekat.");
        }
    },
    {
        command: ["unblock"],
        help: ["unblock <@tag|nombor>"],
        tags: ["info"],
        owner: true,
        official: true,
        exec: async (m, { sock, text }) => {
            const target = resolveTarget(m, text);
            if (!target) return m.reply("Tag pengguna atau tulis nombor.");
            await sock.updateBlockStatus(target, "unblock");
            return m.reply("✅ Sekatan dibuka.");
        }
    },
    {
        command: ["blocklist", "listblock"],
        help: ["blocklist"],
        tags: ["info"],
        owner: true,
        official: true,
        exec: async (m, { sock }) => {
            const list = await sock.fetchBlocklist();
            if (!list?.length) return m.reply("Tiada pengguna disekat.");
            return m.reply(`🚫 *Senarai Sekatan* (${list.length})\n${list.map((jid, i) => `${i + 1}. @${jid.split("@")[0]}`).join("\n")}`, {
                mentions: list
            });
        }
    }
];
