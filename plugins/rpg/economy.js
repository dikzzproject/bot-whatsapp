const resolveItem = key => (ITEMS[String(key ?? "").toLowerCase()] ? String(key).toLowerCase() : null);

export default [
    {
        command: ["inventory", "inv", "beg"],
        help: ["inventory"],
        tags: ["rpg"],
        exec: (m, { user }) => {
            const items = Object.entries(user.inventory).filter(([, count]) => count > 0);
            const list = items.map(([key, count]) => `◦ ${itemLabel(key)}: ${formatNumber(count)}`).join("\n") || "Kosong.";
            return m.reply(`🎒 *Inventori*\n\n${list}\n\n❤️ Nyawa: ${user.health}/100`);
        }
    },
    {
        command: ["heal", "ubat"],
        help: ["heal"],
        tags: ["rpg"],
        exec: (m, { user }) => {
            if (user.health >= 100) return m.reply("Nyawa anda sudah penuh.");
            if ((user.inventory.potion ?? 0) < 1) return m.reply("Anda tiada potion. Beli dengan .buy potion 1");
            user.inventory.potion -= 1;
            user.health = Math.min(100, user.health + 50);
            return m.reply(`🧪 Potion digunakan. Nyawa: ${user.health}/100`);
        }
    },
    {
        command: ["rest", "tidur"],
        help: ["rest"],
        tags: ["rpg"],
        cooldown: 600,
        exec: (m, { user }) => {
            user.health = Math.min(100, user.health + 30);
            return m.reply(`😴 Anda berehat. Nyawa: ${user.health}/100`);
        }
    },
    {
        command: ["buy", "beli"],
        help: ["buy <item> <jumlah>"],
        tags: ["rpg"],
        exec: (m, { args, user }) => {
            const key = resolveItem(args[0]);
            const amount = Math.max(1, parseInt(args[1] ?? "1", 10) || 1);
            if (!key) return m.reply(`Item tersedia:\n${Object.entries(ITEMS).map(([k, i]) => `◦ ${i.emoji} ${k} — ${formatNumber(i.buy)}`).join("\n")}`);
            const cost = ITEMS[key].buy * amount;
            if (user.money < cost) return m.reply(`Wang tidak cukup. Perlu ${formatNumber(cost)}.`);
            user.money -= cost;
            user.inventory[key] = (user.inventory[key] ?? 0) + amount;
            return m.reply(`🛒 Membeli ${itemLabel(key)} x${amount} dengan ${formatNumber(cost)} wang.`);
        }
    },
    {
        command: ["sell", "jual"],
        help: ["sell <item> <jumlah|all>"],
        tags: ["rpg"],
        exec: (m, { args, user }) => {
            const key = resolveItem(args[0]);
            if (!key) return m.reply("Contoh: .sell kayu 5 atau .sell batu all");
            const owned = user.inventory[key] ?? 0;
            const amount = parseAmount(args[1] ?? "1", owned);
            if (!amount || amount > owned) return m.reply(`Anda hanya ada ${owned} ${key}.`);
            const income = ITEMS[key].sell * amount;
            user.inventory[key] -= amount;
            user.money += income;
            return m.reply(`💵 Menjual ${itemLabel(key)} x${amount} dan mendapat ${formatNumber(income)} wang.`);
        }
    },
    {
        command: ["atm", "bank"],
        help: ["atm"],
        tags: ["rpg"],
        exec: (m, { user }) => m.reply(`🏦 *Bank*\nWang tunai : ${formatNumber(user.money)}\nSimpanan   : ${formatNumber(user.bank)}`)
    },
    {
        command: ["nabung", "deposit"],
        help: ["nabung <jumlah|all>"],
        tags: ["rpg"],
        needText: true,
        exec: (m, { args, user }) => {
            const amount = parseAmount(args[0], user.money);
            if (!amount || amount > user.money) return m.reply("Jumlah tidak sah atau wang tidak cukup.");
            user.money -= amount;
            user.bank += amount;
            return m.reply(`🏦 ${formatNumber(amount)} wang disimpan ke bank.`);
        }
    },
    {
        command: ["tarik", "withdraw"],
        help: ["tarik <jumlah|all>"],
        tags: ["rpg"],
        needText: true,
        exec: (m, { args, user }) => {
            const amount = parseAmount(args[0], user.bank);
            if (!amount || amount > user.bank) return m.reply("Jumlah tidak sah atau simpanan tidak cukup.");
            user.bank -= amount;
            user.money += amount;
            return m.reply(`💵 ${formatNumber(amount)} wang dikeluarkan dari bank.`);
        }
    },
    {
        command: ["transfer", "bagi"],
        help: ["transfer <money|limit> <jumlah> <@tag>"],
        tags: ["rpg"],
        group: true,
        exec: (m, { args, user, db }) => {
            const type = (args[0] ?? "").toLowerCase();
            if (!["money", "limit"].includes(type) || !m.target) {
                return m.reply("Guna: .transfer money 500 @tag atau .transfer limit 5 @tag");
            }
            if (m.target === m.userId) return m.reply("Tidak boleh memindahkan kepada diri sendiri.");
            const amount = parseAmount(args[1], user[type]);
            if (!amount || amount > user[type]) return m.reply(`Jumlah tidak sah atau ${type} tidak cukup.`);
            const receiver = db.users.get(m.target);
            user[type] -= amount;
            receiver[type] += amount;
            return m.reply(`✅ ${formatNumber(amount)} ${type} dipindahkan kepada @${m.target.split("@")[0]}.`, { mentions: [m.target] });
        }
    }
];
