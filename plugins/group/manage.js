import { cleanNumber, toUserJid } from "#lib/utils.js";

const targetOf = (m, text) =>
    m.target || (cleanNumber(text) ? toUserJid(text) : "");

const participantAction =
    (action, doneText) =>
    async (m, { sock, text, participants }) => {
        const target = targetOf(m, text);
        if (!target)
            return m.reply("Tag pengguna, balas mesejnya, atau tulis nombor.");
        const botParts = [sock.botJid, sock.botLid]
            .filter(Boolean)
            .map(jid => jid.split("@")[0]);
        if (botParts.includes(target.split("@")[0]))
            return m.reply("Saya tidak boleh melakukannya pada diri sendiri.");

        const match = participants.find(p =>
            [p.id, p.lid, p.phoneNumber].includes(target)
        );
        const jid = match?.id ?? target;
        const result = await sock.groupParticipantsUpdate(
            m.chat,
            [jid],
            action
        );
        const status = result?.[0]?.status;
        if (status && status !== "200")
            return m.reply(`⚠️ Gagal (kod ${status}). Pastikan nombor betul.`);
        return m.reply(doneText);
    };

const common = { tags: ["group"], group: true, admin: true, botAdmin: true };

export default [
    {
        ...common,
        command: ["kick", "keluarkan"],
        help: ["kick <@tag>"],
        blacklist: true,
        exec: participantAction("remove", "✅ Ahli dikeluarkan.")
    },
    {
        ...common,
        command: ["add", "tambah"],
        help: ["add <nombor>"],
        needText: true,
        exec: participantAction("add", "✅ Permintaan tambah dihantar.")
    },
    {
        ...common,
        command: ["promote", "jadiadmin"],
        help: ["promote <@tag>"],
        exec: participantAction("promote", "✅ Ahli dinaikkan menjadi admin.")
    },
    {
        ...common,
        command: ["demote", "hapusadmin"],
        help: ["demote <@tag>"],
        exec: participantAction("demote", "✅ Admin diturunkan.")
    },
    {
        ...common,
        command: ["opengc", "open", "buka"],
        help: ["opengc"],
        exec: async (m, { sock }) => {
            await sock.groupSettingUpdate(m.chat, "not_announcement");
            return m.reply(
                "🔓 Kumpulan dibuka. Semua ahli boleh menghantar mesej."
            );
        }
    },
    {
        ...common,
        command: ["closegc", "close", "tutup"],
        help: ["closegc"],
        exec: async (m, { sock }) => {
            await sock.groupSettingUpdate(m.chat, "announcement");
            return m.reply(
                "🔒 Kumpulan ditutup. Hanya admin boleh menghantar mesej."
            );
        }
    },
    {
        ...common,
        command: ["linkgc", "linkgroup"],
        help: ["linkgc"],
        exec: async (m, { sock }) =>
            m.reply(
                `https://chat.whatsapp.com/${await sock.groupInviteCode(m.chat)}`
            )
    },
    {
        ...common,
        command: ["revoke", "resetlink"],
        help: ["revoke"],
        exec: async (m, { sock }) => {
            const code = await sock.groupRevokeInvite(m.chat);
            return m.reply(
                `✅ Pautan ditetapkan semula:\nhttps://chat.whatsapp.com/${code}`
            );
        }
    },
    {
        tags: ["group"],
        group: true,
        command: ["groupinfo", "gcinfo"],
        help: ["groupinfo"],
        exec: (m, { metadata, participants, group }) => {
            const admins = participants.filter(p => p.admin).length;
            return m.reply(
                [
                    `👥 *${metadata?.subject ?? "Kumpulan"}*`,
                    `ID      : ${m.chat}`,
                    `Ahli    : ${participants.length}`,
                    `Admin   : ${admins}`,
                    `Welcome : ${group.welcome ? "ON" : "OFF"}`,
                    `Antilink: ${group.antilink ? "ON" : "OFF"}`,
                    `Mute    : ${group.mute ? "ON" : "OFF"}`,
                    "",
                    metadata?.desc || "Tiada penerangan."
                ].join("\n")
            );
        }
    }
];
