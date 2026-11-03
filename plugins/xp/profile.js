import db from "#database";
import { defaultAvatar } from "#lib/media.js";
import { addExp, expForLevel, reward } from "#lib/economy.js";
import { formatNumber } from "#lib/utils.js";

const BOARDS = ["money", "bank", "exp", "level", "limit"];

function resolveUser(m, ctx) {
    if (!m.target) return { id: m.userId, user: ctx.user, name: m.name };
    const record = db.users.find(m.target);
    return { id: m.target, user: record, name: record?.name || `@${m.target.split("@")[0]}` };
}

export default [
    {
        command: ["profile", "profil", "me", "my", "status"],
        help: ["profile [@tag]"],
        tags: ["xp"],
        exec: async (m, ctx) => {
            const { id, user, name } = resolveUser(m, ctx);
            if (!user) return m.reply("Pengguna itu belum pernah menggunakan bot.");

            const next = expForLevel(user.level + 1);
            const text = [
                `👤 *Profil ${name}*`,
                `Nombor   : ${id.split("@")[0]}`,
                `Daftar   : ${user.registered ? `Ya (${user.age} tahun)` : "Belum"}`,
                `Level    : ${user.level} (${formatNumber(user.exp)}/${formatNumber(next)} exp)`,
                `Limit    : ${formatNumber(user.limit)}`,
                `Wang     : ${formatNumber(user.money)}`,
                `Bank     : ${formatNumber(user.bank)}`,
                `Nyawa    : ${user.health}/100`,
                `Premium  : ${user.premium ? "Ya" : "Tidak"}`,
                `Pasangan : ${user.partner ? `@${user.partner.split("@")[0]}` : "Tiada"}`
            ].join("\n");

            let picture = null;
            try {
                picture = { url: await ctx.sock.profilePictureUrl(id, "image") };
            } catch {
                picture = defaultAvatar();
            }

            const mentions = user.partner ? [user.partner] : [];
            if (!picture) return m.reply(text, { mentions });
            return ctx.sock.sendMessage(m.chat, { image: picture, caption: text, mentions }, { quoted: m });
        }
    },
    {
        command: ["daftar", "register"],
        help: ["daftar nama.umur"],
        tags: ["xp"],
        usage: ".daftar nama.umur",
        example: "{prefix}daftar Ali.18",
        needText: true,
        exec: async (m, { user, text }) => {
            if (user.registered) return m.reply("Anda sudah mendaftar.");
            const match = text.match(/^(.+?)\s*[.|,]\s*(\d{1,2})$/);
            const name = match?.[1].trim();
            const age = Number(match?.[2]);
            if (!name || name.length > 25 || age < 5 || age > 80) {
                return m.reply("Format salah. Contoh: .daftar Ali.18 (umur 5-80)");
            }
            user.registered = true;
            user.name = name;
            user.age = age;
            user.registeredAt = Date.now();
            const bonus = config.economy.registerBonus;
            reward(user, bonus);
            return m.reply(
                `✅ Pendaftaran berjaya!\nNama: ${name}\nUmur: ${age}\n\nBonus: ${formatNumber(bonus.money)} wang, ${bonus.limit} limit, ${bonus.exp} exp.`
            );
        }
    },
    {
        command: ["unregister", "nyahdaftar"],
        help: ["unregister"],
        tags: ["xp"],
        exec: async (m, { user }) => {
            if (!user.registered) return m.reply("Anda belum mendaftar.");
            user.registered = false;
            user.age = 0;
            return m.reply("✅ Pendaftaran anda dibatalkan.");
        }
    },
    {
        command: ["limit"],
        help: ["limit"],
        tags: ["xp"],
        exec: (m, { user, isPremium }) =>
            m.reply(`🔋 Limit anda: ${isPremium ? "tanpa had (premium)" : formatNumber(user.limit)}`)
    },
    {
        command: ["money", "wang"],
        help: ["money"],
        tags: ["xp"],
        exec: (m, { user }) => m.reply(`💰 Wang: ${formatNumber(user.money)}\n🏦 Bank: ${formatNumber(user.bank)}`)
    },
    {
        command: ["levelup", "level"],
        help: ["levelup"],
        tags: ["xp"],
        exec: (m, { user }) => {
            const { leveledUp } = addExp(user, 0);
            const need = expForLevel(user.level + 1) - user.exp;
            return m.reply(
                `🏅 Level ${user.level}${leveledUp ? " (naik level!)" : ""}\nPerlukan ${formatNumber(need)} exp lagi untuk level ${user.level + 1}.`
            );
        }
    },
    {
        command: ["leaderboard", "lb"],
        help: ["leaderboard <money|bank|exp|level|limit>"],
        tags: ["xp"],
        exec: (m, { text, prefix }) => {
            const board = (text || "level").toLowerCase();
            if (!BOARDS.includes(board)) return m.reply(`Pilihan: ${BOARDS.join(", ")}\nContoh: ${prefix}lb money`);
            const rows = db.users
                .entries()
                .sort(([, a], [, b]) => b[board] - a[board])
                .slice(0, 10);
            const lines = rows.map(
                ([id, user], i) => `${i + 1}. ${user.name || id.split("@")[0]} — ${formatNumber(user[board])}`
            );
            return m.reply(`🏆 *Papan Pendahulu: ${board}*\n\n${lines.join("\n") || "Tiada data."}`);
        }
    }
];

