export default {
    name: "user-registration-interactive",
    command: ["reg", "daftar", "register"],
    tags: ["main"],
    help: ["reg", "register", "daftar"],

    run: async (m, ctx) => {
        const { conn, usedPrefix, user } = ctx;
        if (user.registered) {
            return m.reply(
                `💡 *Maklumat:* Akaun anda telah didaftarkan dengan nama *${user.name}*. Jika anda mahu memadam data anda, gunakan arahan *${usedPrefix}unreg*.`
            );
        }

        return wizard.start(m, ctx, {
            steps: [
                {
                    key: "name",
                    ask: "👋 *Helo!* Selamat datang ke proses pendaftaran.\n\nSebelum kita meneruskan, boleh saya tahu *Nama Penuh* atau nama panggilan anda?\n\n_Sila balas terus di bawah!_ ✨",
                    parse: input =>
                        input.length > 25 ? { error: "Nama panggilan anda terlalu panjang, maksimum 25 aksara." } : { value: input }
                },
                {
                    key: "age",
                    ask: answers => `Gembira berkenalan dengan anda, *${answers.name}*!\n\nSekarang, boleh saya tahu umur anda?\n_Hanya taip nombor sahaja, contoh: *18*_`,
                    parse: input => {
                        const age = parseInt(input, 10);
                        return Number.isNaN(age) || age <= 10 || age > 100
                            ? { error: "Sila masukkan umur yang sah (10 - 100)." }
                            : { value: age };
                    }
                }
            ],
            onDone: async (answers, msg, ctx) => {
                const target = ctx.user;
                target.name = answers.name;
                target.age = answers.age;
                target.registered = true;
                target.registeredAt = Date.now();
                target.sn = nodeCrypto.createHash("md5").update(msg.userId).digest("hex");
                const bonus = config.economy.registerBonus;
                reward(target, bonus);

                const picture = await conn
                    .profilePictureUrl(msg.sender, "image")
                    .then(url => ({ url }))
                    .catch(() => defaultAvatar());

                const caption = [
                    "📑  *PENDAFTARAN BERJAYA*",
                    "",
                    "Tahniah! Profil anda telah disimpan ke dalam pangkalan data bot. ✨",
                    "",
                    `👤 *Nama:* ${target.name}`,
                    `📞 *Nombor*: @${jidUser(msg.sender)}`,
                    `🎂 *Umur:* ${target.age} Tahun`,
                    `🎁 *Bonus:* ${formatNumber(bonus.money)} wang, ${bonus.limit} had, ${bonus.exp} exp`,
                    ""
                ].join("\n");

                if (!picture) return msg.reply(caption, { mentions: [msg.sender] });
                return conn.sendMessage(msg.chat, { image: picture, caption, mentions: [msg.sender] }, { quoted: msg });
            }
        });
    }
};
