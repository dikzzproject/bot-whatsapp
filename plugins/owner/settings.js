const { OWNER_ONLY, parseSwitch } = ownerKit;

const state = value => (value ? "ON" : "OFF");

const toggle = ({ command, label, read, write }) => ({
    ...OWNER_ONLY,
    command: [command],
    help: [`${command} <on/off>`],
    exec: (m, { args, db, prefix }) => {
        const value = parseSwitch(args[0]);
        if (value === null)
            return m.reply(
                `${label}: *${state(read(db))}*\nGuna: ${prefix}${command} on|off`
            );
        write(db, value);
        return m.reply(`✅ ${label}: *${state(value)}*`);
    }
});

export default [
    toggle({
        command: "self",
        label: "Mod self (owner sahaja)",
        read: db => db.settings.mode === "self",
        write: (db, value) => (db.settings.mode = value ? "self" : "public")
    }),
    toggle({
        command: "autoread",
        label: "Baca mesej automatik",
        read: db => db.settings.autoRead,
        write: (db, value) => (db.settings.autoRead = value)
    }),
    toggle({
        command: "typing",
        label: "Menaip automatik",
        read: db => db.settings.autoTyping,
        write: (db, value) => (db.settings.autoTyping = value)
    }),
    {
        ...OWNER_ONLY,
        command: ["anticall"],
        help: ["anticall <on/off> [block/unblock]"],
        exec: (m, { args, db, prefix }) => {
            const value = parseSwitch(args[0]);
            if (value === null) {
                return m.reply(
                    `Tolak panggilan: *${state(db.settings.rejectCall)}*\nSekat pemanggil: *${state(db.settings.callBlock)}*\nGuna: ${prefix}anticall on|off [block|unblock]`
                );
            }
            db.settings.rejectCall = value;
            const mode = (args[1] ?? "").toLowerCase();
            if (mode === "block") db.settings.callBlock = true;
            if (mode === "unblock") db.settings.callBlock = false;
            return m.reply(
                `✅ Tolak panggilan: *${state(value)}*\nSekat pemanggil: *${state(db.settings.callBlock)}*`
            );
        }
    },
    {
        ...OWNER_ONLY,
        command: ["botsetting", "globalsetting"],
        help: ["botsetting"],
        exec: (m, { db }) => {
            const s = db.settings;
            return m.reply(
                [
                    `⚙️ *Tetapan Bot*`,
                    `Mod              : ${s.mode}`,
                    `Baca automatik   : ${state(s.autoRead)}`,
                    `Menaip automatik : ${state(s.autoTyping)}`,
                    `Baca status      : ${state(s.autoReadStatus.enabled)}`,
                    `Emoji status     : ${state(s.autoReadStatus.emoji)}`,
                    `Sentiasa online  : ${state(s.statusOnline)}`,
                    `Tolak panggilan  : ${state(s.rejectCall)}`,
                    `Sekat pemanggil  : ${state(s.callBlock)}`,
                    `Abaikan mesej    : > ${Math.max(s.ignoreOldMessageSec, 30)} saat`,
                    `Chat diharamkan  : ${Object.keys(s.bannedChats ?? {}).length}`,
                    `Kumpulan disewa  : ${Object.keys(s.rentals ?? {}).length}`,
                    `Pengguna         : ${db.users.size}`,
                    `Kumpulan         : ${db.groups.size}`
                ].join("\n")
            );
        }
    },
    {
        ...OWNER_ONLY,
        command: ["setppbot", "setpp"],
        help: ["setppbot"],
        media: ["image"],
        exec: async (m, { sock }) => {
            let q = m.quoted ? m.quoted : m;
            let mime = (q.msg || q).mimetype || "";
            if (!/image/.test(mime)) {
                return m.reply(
                    "📸 Sila balas imej untuk dijadikan gambar profil bot."
                );
            }

            await m.reply("🔄 *Memproses gambar profil bot...* ✨");

            try {
                let media = await q.download();
                if (!media) {
                    await m.react("❌");
                    return m.reply("❌ Gagal memuat turun imej.");
                }

                const image = await Jimp.read(media);

                let w = image.width;
                let h = image.height;
                const max = 640;

                if (w > h) {
                    h = Math.floor(h * (max / w));
                    w = max;
                } else {
                    w = Math.floor(w * (max / h));
                    h = max;
                }

                image.resize({
                    w: w,
                    h: h,
                    mode: ResizeStrategy.bilinear
                });

                const img = await image.getBuffer(JimpMime.jpeg);

                await conn.query({
                    tag: "iq",
                    attrs: {
                        to: "s.whatsapp.net",
                        type: "set",
                        xmlns: "w:profile:picture"
                    },
                    content: [
                        {
                            tag: "picture",
                            attrs: { type: "image" },
                            content: img
                        }
                    ]
                });

                await m.react("✅");
                return m.reply(
                    "✅ *BERJAYA!* Gambar profil bot telah dikemas kini."
                );
            } catch (e) {
                console.error("[SETPPBOT ERROR]:", e);
                await m.react("❌");
                return m.reply(`❌ *Failed:* ${e.message || e}`);
            }
        }
    },
    {
        ...OWNER_ONLY,
        command: ["restart"],
        help: ["restart"],
        exec: async m => {
            if (!process.send)
                return m.reply(
                    "Bot tidak dijalankan melalui index.js, restart dibatalkan."
                );
            await m.reply("🔄 Memulakan semula bot...");
            setTimeout(() => process.send("reset"), 1000);
        }
    }
];
