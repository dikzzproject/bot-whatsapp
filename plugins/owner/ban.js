const { OWNER_ONLY, bannedChats, formatDate, pickTarget } = ownerKit;

const targetChat = (m, args, groupOnly) => {
    const jid = args.find(arg => /@(g\.us|s\.whatsapp\.net|lid)$/.test(arg)) ?? m.chat;
    if (groupOnly && !jid.endsWith("@g.us")) return null;
    return jid;
};

const banChat = groupOnly => (m, { args, db }) => {
    const jid = targetChat(m, args, groupOnly);
    if (!jid) return m.reply("Guna dalam kumpulan atau nyatakan ID kumpulan (@g.us).");
    const reason = args.filter(arg => arg !== jid).join(" ") || "Tiada sebab";
    bannedChats(db)[jid] = { reason, by: m.number, at: Date.now() };
    return m.reply(`🚫 Bot tidak lagi membalas di:\n${jid}\nSebab: ${reason}`);
};

const unbanChat = groupOnly => (m, { args, db }) => {
    const jid = targetChat(m, args, groupOnly);
    if (!jid) return m.reply("Guna dalam kumpulan atau nyatakan ID kumpulan (@g.us).");
    if (!bannedChats(db)[jid]) return m.reply("Chat itu tidak berada dalam senarai larangan.");
    delete bannedChats(db)[jid];
    return m.reply(`✅ Larangan dibuka untuk:\n${jid}`);
};

export default [
    {
        tags: ["owner"],
        hidden: true,
        before: (m, ctx) => !ctx.isOwner && Boolean(bannedChats(ctx.db)[m.chat])
    },
    {
        ...OWNER_ONLY,
        command: ["banchat"],
        help: ["banchat", "banchat [jid]"],
        exec: banChat(false)
    },
    {
        ...OWNER_ONLY,
        command: ["unbanchat"],
        help: ["unbanchat", "unbanchat [jid]"],
        exec: unbanChat(false)
    },
    {
        ...OWNER_ONLY,
        command: ["bangc"],
        help: ["bangc"],
        exec: banChat(true)
    },
    {
        ...OWNER_ONLY,
        command: ["unbangc"],
        help: ["unbangc"],
        exec: unbanChat(true)
    },
    {
        ...OWNER_ONLY,
        command: ["ban"],
        help: ["ban @user"],
        exec: (m, ctx) => {
            const { jid, rest } = pickTarget(m, ctx);
            if (!jid) return m.reply("Tag pengguna, balas mesejnya, atau tulis nombor.");
            if (ctx.isOwner && jid === m.userId) return m.reply("Anda tidak boleh menyekat diri sendiri.");
            const user = ctx.db.users.get(jid);
            user.banned = true;
            return m.reply(`🚫 @${jid.split("@")[0]} disekat daripada menggunakan bot.${rest.length ? `\nSebab: ${rest.join(" ")}` : ""}`, { mentions: [jid] });
        }
    },
    {
        ...OWNER_ONLY,
        command: ["unban"],
        help: ["unban @user"],
        exec: (m, ctx) => {
            const { jid } = pickTarget(m, ctx);
            if (!jid) return m.reply("Tag pengguna, balas mesejnya, atau tulis nombor.");
            const user = ctx.db.users.find(jid);
            if (!user?.banned) return m.reply("Pengguna itu tidak disekat.");
            user.banned = false;
            return m.reply(`✅ @${jid.split("@")[0]} dibenarkan semula.`, { mentions: [jid] });
        }
    },
    {
        ...OWNER_ONLY,
        command: ["listban"],
        help: ["listban"],
        exec: (m, { db }) => {
            const users = db.users.entries().filter(([, user]) => user.banned);
            const chats = Object.entries(bannedChats(db));
            const userLines = users.map(([id, user], i) => `${i + 1}. @${id.split("@")[0]}${user.name ? ` (${user.name})` : ""}`);
            const chatLines = chats.map(([jid, info], i) => `${i + 1}. ${jid}\n   ${info.reason} • ${formatDate(info.at)}`);
            return m.reply(
                [
                    `🚫 *Pengguna disekat* (${users.length})`,
                    userLines.join("\n") || "Tiada.",
                    "",
                    `🚫 *Chat diharamkan* (${chats.length})`,
                    chatLines.join("\n") || "Tiada."
                ].join("\n"),
                { mentions: users.map(([id]) => id) }
            );
        }
    }
];
