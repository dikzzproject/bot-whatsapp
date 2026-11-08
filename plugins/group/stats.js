export default {
    command: ["totalchat"],
    help: ["totalchat", "totalchat --top", "totalchat --reset"],
    tags: ["group"],
    group: true,
    exec: (m, { group, text, isAdmin, isOwner }) => {
        const rows = Object.entries(group.stats).sort(([, a], [, b]) => b - a);
        const total = rows.reduce((sum, [, count]) => sum + count, 0);

        if (text.includes("--reset")) {
            if (!isAdmin && !isOwner)
                return m.reply(
                    "Hanya admin boleh menetapkan semula statistik."
                );
            group.stats = {};
            return m.reply("✅ Statistik chat ditetapkan semula.");
        }

        if (text.includes("--top")) {
            const list = rows
                .slice(0, 10)
                .map(
                    ([number, count], i) =>
                        `${i + 1}. @${number} — ${formatNumber(count)}`
                )
                .join("\n");
            return m.reply(
                `🏆 *Ahli Paling Aktif*\n\n${list || "Tiada data."}`
            );
        }

        return m.reply(
            `💬 Jumlah mesej dikira: ${formatNumber(total)}\nAnda: ${formatNumber(group.stats[m.userId] ?? 0)}`
        );
    }
};
