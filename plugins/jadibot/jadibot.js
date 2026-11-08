const requesterIds = (m, ctx) => jadibot.ownedSessionIds(m, ctx);

export default [
    {
        command: ["jadibot", "becomebot"],
        help: ["jadibot"],
        tags: ["jadibot"],
        private: false,
        official: true,
        description: "Daftar jadibot melalui soal-jawab (nama, nombor, email web)",
        run: (m, ctx) => jadibot.startFromMessage(m, ctx)
    },
    {
        command: ["listjadibot", "jadibotlist", "myjadibot"],
        help: ["listjadibot"],
        tags: ["jadibot"],
        official: true,
        run: (m, ctx) => {
            const ids = requesterIds(m, ctx);
            const items = db.jadibot
                .listSessions()
                .filter(item => !ids || ids.includes(item.id))
                .map(item => jadibot.describe(item.id));
            return m.reply(jadibot.listText(items, ctx.isOwner ? "Semua Jadibot" : "Jadibot Anda"));
        }
    },
    {
        command: ["killjadibot", "stopjadibot", "deljadibot"],
        help: ["killjadibot <nama | sesi | nombor>"],
        tags: ["jadibot"],
        official: true,
        description: "Padam jadibot dan nyahpaut peranti",
        run: async (m, ctx) => {
            const ids = requesterIds(m, ctx);
            let query = ctx.text;
            if (!query) {
                if (ids?.length === 1) query = ids[0];
                else return m.reply(`Nyatakan nama bot, nama sesi atau nombor.\nLihat senarai: ${ctx.usedPrefix}listjadibot`);
            }
            const record = await jadibot.killSession(query, { reason: "Dihentikan oleh pemilik.", onlyIds: ids });
            return m.reply(`✅ Jadibot *${record.name}* (${record.id}) dipadam. Sesi dan peranti dinyahpautkan.`);
        }
    },
    {
        command: ["restartjadibot"],
        help: ["restartjadibot <nama | sesi | nombor>"],
        tags: ["jadibot"],
        official: true,
        needText: true,
        run: async (m, ctx) => {
            const record = await jadibot.restartSession(ctx.text, { onlyIds: requesterIds(m, ctx) });
            return m.reply(`🔄 Jadibot *${record.name}* dimulakan semula.`);
        }
    },
    {
        command: ["webpass", "resetwebpass"],
        help: ["webpass"],
        tags: ["jadibot"],
        private: false,
        official: true,
        description: "Jana kata laluan baharu untuk dashboard web",
        run: async (m, ctx) => {
            const results = await accounts.resetPasswordForOwner(m.userId);
            const lines = results.map(item => `Email: ${item.email}\nKata laluan baharu: *${item.password}*`);
            return m.reply(`🔑 *Kata laluan dashboard*\n\n${lines.join("\n\n")}\n\nLog masuk: ${jadibot.webUrl()}`);
        }
    },
    {
        command: ["delaccount", "padamakaun"],
        help: ["delaccount"],
        tags: ["jadibot"],
        private: false,
        official: true,
        description: "Padam akaun web dan semua jadibot di bawahnya",
        run: (m, ctx) => {
            const owned = db.accounts.findByOwnerId(m.userId);
            if (!owned.length) return m.reply("Anda tidak mempunyai akaun web.");
            return wizard.start(m, ctx, {
                steps: [
                    {
                        key: "confirm",
                        ask: `⚠️ Akaun *${owned.map(item => item.email).join(", ")}* dan semua jadibot di bawahnya akan dipadam kekal.\n\nTaip *PADAM* untuk mengesahkan.`,
                        parse: input => (input === "PADAM" ? { value: true } : { error: "Taip PADAM (huruf besar) untuk mengesahkan, atau *batal*." })
                    }
                ],
                onDone: async (answers, msg) => {
                    let bots = 0;
                    for (const account of owned) bots += await accounts.removeAccount(account.email);
                    return msg.reply(`🗑️ ${owned.length} akaun dan ${bots} jadibot dipadam.`);
                }
            });
        }
    }
];
