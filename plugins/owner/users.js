const { OWNER_ONLY, pickTarget } = ownerKit;

export default [
    {
        ...OWNER_ONLY,
        command: ["block"],
        help: ["block @user"],
        exec: async (m, ctx) => {
            const { jid } = pickTarget(m, ctx);
            if (!jid) return m.reply("Tag pengguna, balas mesejnya, atau tulis nombor.");
            await ctx.sock.updateBlockStatus(jid, "block");
            return m.reply(`✅ @${jid.split("@")[0]} disekat di WhatsApp.`, { mentions: [jid] });
        }
    },
    {
        ...OWNER_ONLY,
        command: ["unblock"],
        help: ["unblock @user"],
        exec: async (m, ctx) => {
            const { jid } = pickTarget(m, ctx);
            if (!jid) return m.reply("Tag pengguna, balas mesejnya, atau tulis nombor.");
            await ctx.sock.updateBlockStatus(jid, "unblock");
            return m.reply(`✅ Sekatan WhatsApp @${jid.split("@")[0]} dibuka.`, { mentions: [jid] });
        }
    },
    {
        ...OWNER_ONLY,
        command: ["listblock", "blocklist"],
        help: ["listblock"],
        exec: async (m, { sock }) => {
            const list = await sock.fetchBlocklist();
            if (!list?.length) return m.reply("Tiada pengguna disekat di WhatsApp.");
            const lines = list.map((jid, i) => `${i + 1}. @${jid.split("@")[0]}`);
            return m.reply(`🚫 *Senarai Sekatan WhatsApp* (${list.length})\n${lines.join("\n")}`, { mentions: list });
        }
    }
];
