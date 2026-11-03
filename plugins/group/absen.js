export default [
    {
        command: ["absen"],
        help: ["absen [nota|reset]"],
        tags: ["group"],
        group: true,
        exec: (m, { group, text, isAdmin, isOwner }) => {
            const absen = group.absen;
            const manager = isAdmin || isOwner;

            if (/^reset$/i.test(text)) {
                if (!manager) return m.reply("Hanya admin boleh menetapkan semula absen.");
                group.absen = { open: false, note: "", list: {} };
                return m.reply("✅ Absen ditetapkan semula.");
            }

            if (text && manager) {
                group.absen = { open: true, note: text, list: {} };
                return m.reply(`📋 Absen dibuka: *${text}*\nTaip .hadir untuk hadir.`);
            }

            const rows = Object.entries(absen.list);
            if (!absen.open) return m.reply("Tiada sesi absen. Admin boleh mula dengan .absen <nota>");
            const list = rows.map(([number, name], i) => `${i + 1}. ${name} (${number})`).join("\n") || "Belum ada yang hadir.";
            return m.reply(`📋 *Absen: ${absen.note}*\nHadir: ${rows.length}\n\n${list}`);
        }
    },
    {
        command: ["hadir"],
        help: ["hadir"],
        tags: ["group"],
        group: true,
        exec: (m, { group }) => {
            if (!group.absen.open) return m.reply("Tiada sesi absen yang sedang dibuka.");
            if (group.absen.list[m.number]) return m.reply("Anda sudah hadir.");
            group.absen.list[m.number] = m.name;
            return m.reply(`✅ ${m.name} hadir. Jumlah: ${Object.keys(group.absen.list).length}`);
        }
    }
];
