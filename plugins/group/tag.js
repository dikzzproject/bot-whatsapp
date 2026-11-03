const mentionsOf = participants => participants.map(p => p.id);

export default [
    {
        command: ["tagall"],
        help: ["tagall <mesej>"],
        tags: ["group"],
        group: true,
        admin: true,
        blacklist: true,
        exec: async (m, { participants, text }) => {
            const list = participants.map(p => `◦ @${p.id.split("@")[0]}`).join("\n");
            return m.reply(`📢 *TAG ALL*\n${text || ""}\n\n${list}`, { mentions: mentionsOf(participants) });
        }
    },
    {
        command: ["hidetag", "ht", "h", "pengumuman"],
        help: ["h <msej>", "hidetag <mesej>"],
        tags: ["group"],
        group: true,
        admin: true,
        exec: (m, { sock, participants, text }) => {
            const message = text || m.quoted?.text;
            if (!message) return m.reply("Tulis mesej atau balas mesej yang mahu diumumkan.");
            return sock.sendMessage(m.chat, { text: message, mentions: mentionsOf(participants) });
        }
    },
    {
        command: ["tagadmin", "admin"],
        help: ["tagadmin <laporan>"],
        tags: ["group"],
        group: true,
        exec: (m, { participants, text }) => {
            const admins = participants.filter(p => p.admin);
            const list = admins.map(p => `◦ @${p.id.split("@")[0]}`).join("\n");
            return m.reply(`🛡️ *Tag Admin*\n${text || "idk."}\n\n${list}`, {
                mentions: mentionsOf(admins)
            });
        }
    }
];
