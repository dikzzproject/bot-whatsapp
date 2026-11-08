const { OWNER_ONLY, formatDate, parseDays, pickTarget } = ownerKit;

const DAY_MS = 24 * 60 * 60 * 1000;

export default [
    {
        ...OWNER_ONLY,
        command: ["addprem"],
        help: ["addprem @user <days>"],
        exec: (m, ctx) => {
            const { jid, rest } = pickTarget(m, ctx);
            const days = parseDays(rest[0]);
            if (!jid || days === null) {
                return m.reply(`Guna: ${ctx.prefix}addprem @user <hari>\nContoh: ${ctx.prefix}addprem @user 30\nPermanen: ${ctx.prefix}addprem @user perm`);
            }

            const user = ctx.db.users.get(jid);
            const now = Date.now();
            const base = isPremium(user) && user.premiumUntil ? user.premiumUntil : now;
            user.premium = true;
            user.premiumUntil = days === 0 ? 0 : base + days * DAY_MS;

            return m.reply(`💎 @${jid.split("@")[0]} kini premium.\nTamat: ${formatDate(user.premiumUntil)}`, { mentions: [jid] });
        }
    },
    {
        ...OWNER_ONLY,
        command: ["delprem"],
        help: ["delprem @user"],
        exec: (m, ctx) => {
            const { jid } = pickTarget(m, ctx);
            if (!jid) return m.reply("Tag pengguna, balas mesejnya, atau tulis nombor.");
            const user = ctx.db.users.find(jid);
            if (!user?.premium) return m.reply("Pengguna itu bukan premium.");
            user.premium = false;
            user.premiumUntil = 0;
            return m.reply(`✅ Premium @${jid.split("@")[0]} dibatalkan.`, { mentions: [jid] });
        }
    },
    {
        ...OWNER_ONLY,
        command: ["listprem"],
        help: ["listprem"],
        exec: (m, { db }) => {
            const rows = db.users.entries().filter(([, user]) => isPremium(user));
            if (!rows.length) return m.reply("Tiada pengguna premium.");
            const lines = rows.map(([id, user], i) => `${i + 1}. @${id.split("@")[0]}\n   Tamat: ${formatDate(user.premiumUntil)}`);
            return m.reply(`💎 *Senarai Premium* (${rows.length})\n\n${lines.join("\n")}`, { mentions: rows.map(([id]) => id) });
        }
    }
];
