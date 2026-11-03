const MAX_WARN = 5;

export default [
    {
        command: ["warn", "amaran"],
        help: ["warn <@tag> [sebab]"],
        tags: ["group"],
        group: true,
        admin: true,
        exec: async (m, { sock, group, text, isBotAdmin }) => {
            if (!m.target) return m.reply("Tag pengguna atau balas mesejnya.");
            const key = m.target.split("@")[0];
            group.warns[key] = (group.warns[key] ?? 0) + 1;
            const count = group.warns[key];
            const reason = text.replace(/@\d+/g, "").trim() || "Tiada sebab";

            await m.reply(
                `⚠️ @${key} diberi amaran (${count}/${MAX_WARN}).\nSebab: ${reason}`,
                { mentions: [m.target] }
            );

            if (count >= MAX_WARN) {
                delete group.warns[key];
                if (!isBotAdmin)
                    return m.reply(
                        "Had amaran dicapai, tetapi bot bukan admin untuk mengeluarkan ahli."
                    );
                await sock.groupParticipantsUpdate(
                    m.chat,
                    [m.target],
                    "remove"
                );
                return m.reply(
                    `🚪 @${key} dikeluarkan kerana mencapai ${MAX_WARN} amaran.`,
                    { mentions: [m.target] }
                );
            }
        }
    },
    {
        command: ["unwarn", "buangamaran"],
        help: ["unwarn <@tag>"],
        tags: ["group"],
        group: true,
        admin: true,
        exec: (m, { group }) => {
            if (!m.target) return m.reply("Tag pengguna atau balas mesejnya.");
            const key = m.target.split("@")[0];
            if (!group.warns[key]) return m.reply("Pengguna itu tiada amaran.");
            group.warns[key] -= 1;
            if (group.warns[key] <= 0) delete group.warns[key];
            return m.reply(
                `✅ Satu amaran dibuang. Baki: ${group.warns[key] ?? 0}.`
            );
        }
    },
    {
        command: ["listwarn", "senaraiamaran"],
        help: ["listwarn"],
        tags: ["group"],
        group: true,
        exec: (m, { group }) => {
            const rows = Object.entries(group.warns);
            if (!rows.length) return m.reply("Tiada ahli yang diberi amaran.");
            const text = rows
                .map(
                    ([number, count], i) =>
                        `${i + 1}. @${number} — ${count}/${MAX_WARN}`
                )
                .join("\n");
            return m.reply(`⚠️ *Senarai Amaran*\n${text}`, {
                mentions: rows.map(([number]) => `${number}@s.whatsapp.net`)
            });
        }
    },
    {
        command: ["cekwarn"],
        help: ["cekwarn [@tag]"],
        tags: ["group"],
        group: true,
        exec: (m, { group }) => {
            const key = (m.target || m.userId).split("@")[0];
            return m.reply(
                `⚠️ Amaran @${key}: ${group.warns[key] ?? 0}/${MAX_WARN}`,
                { mentions: [m.target || m.userId] }
            );
        }
    }
];
