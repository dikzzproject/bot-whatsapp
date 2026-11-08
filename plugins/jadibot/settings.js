const base = { tags: ["settings"], botOwner: true };

function apply(ctx, patch) {
    const clean = jadibot.sanitizeSettings(patch);
    if (ctx.sock.isJadibot) return jadibot.updateSettings(ctx.sock.jadibotId, patch);

    const official = db.settings.official;
    if (clean.name) throw new UserError("Nama bot rasmi diubah melalui BOT_NAME dalam .env.");
    if (clean.prefix) official.prefix = clean.prefix;
    if (clean.mode) db.settings.mode = clean.mode;
    if (clean.limit) official.limit = clean.limit;
    if (clean.messages) Object.assign(official.messages, clean.messages);
    return null;
}

function digitsFrom(m, ctx) {
    const found = new Set();
    const target = m.mentionedJid[0] || m.quoted?.sender;
    if (target) {
        found.add(jidUser(target));
        const participant = ctx.participants.find(item => item.id === target || item.lid === target);
        if (participant?.phoneNumber) found.add(jidUser(participant.phoneNumber));
    }
    for (const arg of ctx.args.slice(1)) {
        const digits = cleanNumber(arg);
        if (digits.length >= 6 && !arg.startsWith("@")) found.add(digits);
    }
    return [...found];
}

const showSettings = ctx => {
    const bot = ctx.bot;
    const record = bot.record;
    const placeholders = jadibot.getPlaceholders().map(item => `{${item}}`).join(" ");
    const lines = [
        `⚙️ *Tetapan ${bot.name}*`,
        record ? `Sesi      : ${bot.id}` : "",
        `Awalan    : ${bot.prefix.join(" ")}`,
        `Mod       : ${bot.mode}`,
        `Had harian: ${bot.limit.daily || "tanpa had"}`,
        `Penjaga   : ${bot.owners.length ? bot.owners.map(item => `+${item}`).join(", ") : "tiada"}`,
        record?.accountEmail ? `Email web : ${record.accountEmail}\nDashboard : ${jadibot.webUrl()}` : "",
        "",
        "*Arahan:*",
        `${ctx.usedPrefix}setprefix <awalan...>`,
        `${ctx.usedPrefix}setbotname <nama>`,
        `${ctx.usedPrefix}setowner <add|del|list> <@tag|nombor>`,
        `${ctx.usedPrefix}setlimit <bilangan sehari, 0 = tanpa had>`,
        `${ctx.usedPrefix}setmode <public|self>`,
        `${ctx.usedPrefix}listmsg · ${ctx.usedPrefix}setmsg <kunci> <teks> · ${ctx.usedPrefix}resetmsg <kunci|all>`,
        "",
        `Pemegang tempat dalam mesej: ${placeholders}`
    ];
    return lines.filter(line => line !== "").join("\n");
};

export default [
    {
        ...base,
        command: ["setting", "settings", "botsettings"],
        help: ["setting"],
        run: (m, ctx) => m.reply(showSettings(ctx))
    },
    {
        ...base,
        command: ["setprefix"],
        help: ["setprefix <awalan...>"],
        needText: true,
        example: "{prefix}setprefix . ! #",
        run: (m, ctx) => {
            apply(ctx, { prefix: ctx.args });
            return m.reply(`✅ Awalan ditetapkan: ${ctx.args.join(" ")}`);
        }
    },
    {
        ...base,
        command: ["setbotname"],
        help: ["setbotname <nama>"],
        needText: true,
        run: (m, ctx) => {
            apply(ctx, { name: ctx.text });
            return m.reply(`✅ Nama bot: *${ctx.text}*`);
        }
    },
    {
        ...base,
        command: ["setmode"],
        help: ["setmode <public|self>"],
        needText: true,
        run: (m, ctx) => {
            apply(ctx, { mode: ctx.args[0].toLowerCase() });
            return m.reply(`✅ Mod: *${ctx.args[0].toLowerCase()}*${ctx.args[0].toLowerCase() === "self" ? "\n(Hanya penjaga bot boleh guna perintah.)" : ""}`);
        }
    },
    {
        ...base,
        command: ["setlimit"],
        help: ["setlimit <bilangan>"],
        needText: true,
        run: (m, ctx) => {
            apply(ctx, { limit: { daily: Number(ctx.args[0]) } });
            return m.reply(`✅ Had harian setiap pengguna: *${Number(ctx.args[0]) || "tanpa had"}*`);
        }
    },
    {
        ...base,
        command: ["setowner", "botowner"],
        help: ["setowner <add|del|list> <@tag|nombor>"],
        needText: true,
        run: (m, ctx) => {
            const action = ctx.args[0].toLowerCase();
            if (action === "list") {
                return m.reply(`👑 *Penjaga ${ctx.bot.name}*\n${ctx.bot.owners.map((item, i) => `${i + 1}. +${item}`).join("\n") || "Tiada."}`);
            }
            if (!["add", "del"].includes(action)) throw new UserError("Guna: setowner <add|del|list> <@tag|nombor>");
            const digits = digitsFrom(m, ctx);
            if (!digits.length) throw new UserError("Tag pengguna, balas mesejnya atau tulis nombor.");
            for (const item of digits) {
                if (ctx.sock.isJadibot) jadibot.setOwner(ctx.sock.jadibotId, action, item);
                else if (action === "add") ctx.bot.owners.push(item);
                else ctx.bot.holder.owners = ctx.bot.owners.filter(owner => owner !== item);
            }
            if (!ctx.sock.isJadibot) db.settings.official.owners = unique(db.settings.official.owners);
            return m.reply(`✅ Penjaga ${action === "add" ? "ditambah" : "dibuang"}: ${digits.map(item => `+${item}`).join(", ")}`);
        }
    },
    {
        ...base,
        command: ["listmsg", "msgkeys"],
        help: ["listmsg"],
        run: (m, ctx) => {
            const raw = ctx.bot.rawMessages;
            const lines = jadibot.getPlaceholders && global.botConfig.getMessageKeys().map(key => `• *${key}*: ${raw[key] ? shorten(raw[key], 40) : "_(lalai)_"}`);
            return m.reply(`💬 *Mesej bot*\n${lines.join("\n")}\n\nUbah: ${ctx.usedPrefix}setmsg <kunci> <teks>\nPemegang tempat: ${jadibot.getPlaceholders().map(item => `{${item}}`).join(" ")}`);
        }
    },
    {
        ...base,
        command: ["setmsg"],
        help: ["setmsg <kunci> <teks>"],
        needText: true,
        example: "{prefix}setmsg ownerOnly Hai {user}, arahan ini untuk penjaga sahaja.",
        run: (m, ctx) => {
            const key = ctx.args[0];
            const value = ctx.text.slice(key.length).trim();
            if (!value) throw new UserError("Tulis teks mesej selepas kunci. Taip .listmsg untuk senarai kunci.");
            apply(ctx, { messages: { [key]: value } });
            return m.reply(`✅ Mesej *${key}* dikemas kini.\nContoh paparan: ${renderTemplate(value, ctx.vars)}`, { mentions: [m.sender] });
        }
    },
    {
        ...base,
        command: ["resetmsg"],
        help: ["resetmsg <kunci|all>"],
        needText: true,
        run: (m, ctx) => {
            const key = ctx.args[0];
            if (ctx.sock.isJadibot) jadibot.resetMessages(ctx.sock.jadibotId, key);
            else if (key === "all") db.settings.official.messages = {};
            else delete db.settings.official.messages[key];
            return m.reply(`✅ Mesej ${key === "all" ? "semua" : `*${key}*`} dikembalikan kepada lalai.`);
        }
    }
];
