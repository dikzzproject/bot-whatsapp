const mentionsOf = participants => participants.map(p => p.id);

export default [
    {
        command: ["tagall"],
        help: ["tagall <mesej>"],
        tags: ["group"],
        group: true,
        admin: true,
        blacklist: true,
        exec: async (m, { participants, text }) => {
            const list = participants
                .map(p => `◦ @${p.id.split("@")[0]}`)
                .join("\n");

            return m.reply(`📢 *TAG ALL*\n${text || ""}\n\n${list}`, {
                mentions: mentionsOf(participants)
            });
        }
    },
    {
        name: "group-hidetag",
        command: ["hidetag", "htag", "h"],
        tags: ["group"],
        help: ["hidetag <text>", "h <reply media/text>"],
        group: true,
        admin: true,
        botAdmin: true,

        run: async (m, { conn, text, participants }) => {
            try {
                // 1. Gather all group member IDs to be used as tag targets (mentions)
                let users = participants.map(a => a.id);

                // 2. Format a fake contact as a quoted decoration
                const fkontak = {
                    key: {
                        remoteJid: "status@broadcast",
                        participant: "0@s.whatsapp.net",
                        fromMe: false,
                        id: ""
                    },
                    message: {
                        conversation: "From Admin"
                    }
                };

                // 3. Smart Media Detection Logic (Reads the main message or quoted message)
                let q = m.quoted ? m.quoted : m;
                let mime = (q.msg || q).mimetype || "";
                let msgText = text
                    ? text
                    : m.quoted && (m.quoted.text || m.quoted.caption)
                      ? m.quoted.text || m.quoted.caption
                      : "";

                // If there is no text at all, set a fallback default
                if (!msgText && !mime) msgText = "";

                // 4. Delivery Type Selection Based on Media Type
                if (/image/.test(mime)) {
                    // Image Hidetag
                    let media = await q.download();
                    await conn.sendMessage(
                        m.chat,
                        { image: media, caption: msgText, mentions: users },
                        { quoted: fkontak }
                    );
                } else if (/video/.test(mime)) {
                    // Video Hidetag
                    let media = await q.download();
                    await conn.sendMessage(
                        m.chat,
                        { video: media, caption: msgText, mentions: users },
                        { quoted: fkontak }
                    );
                } else if (/sticker/.test(mime)) {
                    // Sticker Hidetag
                    let media = await q.download();
                    await conn.sendMessage(
                        m.chat,
                        { sticker: media, mentions: users },
                        { quoted: fkontak }
                    );
                } else if (/audio/.test(mime)) {
                    // Audio / Voice Note Hidetag
                    let media = await q.download();
                    await conn.sendMessage(
                        m.chat,
                        {
                            audio: media,
                            mimetype: mime,
                            ptt: mime.includes("audio/ogg"),
                            mentions: users
                        },
                        { quoted: fkontak }
                    );
                } else if (mime) {
                    // Document / Other File Hidetag
                    let media = await q.download();
                    await conn.sendMessage(
                        m.chat,
                        {
                            document: media,
                            mimetype: mime,
                            fileName: q.filename || "file",
                            caption: msgText,
                            mentions: users
                        },
                        { quoted: fkontak }
                    );
                } else {
                    // Plain Text Hidetag (If no media is attached)
                    await conn.sendMessage(
                        m.chat,
                        { text: msgText, mentions: users },
                        { quoted: fkontak }
                    );
                }
            } catch (e) {
                console.error("[HIDETAG ERROR]", e);
                return m.reply("❌ Gagal melaksanakan hidetag multimedia.");
            }
        }
    },
    {
        name: "group-tag-admin",
        command: ["tagadmin", "listadmin"],
        tags: ["group"],
        help: ["tagadmin [report]", "listadmin [report]"],
        group: true,

        run: async (m, { conn, text, participants }) => {
            try {
                await m.react("⏳");

                // 1. Get group profile picture (fallback if missing or fails)
                let pp = await conn
                    .profilePictureUrl(m.chat, "image")
                    .catch(() => "https://cdn.nekohime.site/file/w6auaaco.jpg");

                // 2. Filter admin list
                let groupAdmins = participants.filter(
                    p => p.admin === "admin" || p.admin === "superadmin"
                );

                if (!groupAdmins || groupAdmins.length === 0) {
                    await m.react("❌");
                    return m.reply(
                        "❌ Tiada admin ditemui dalam kumpulan ini."
                    );
                }

                // 3. Get group metadata for group name
                let groupMeta = await conn
                    .groupMetadata(m.chat)
                    .catch(() => null);
                let groupName = groupMeta ? groupMeta.subject : "Group";

                // 4. Build admin mention list
                let mentions = groupAdmins.map(v => v.id);
                let listAdmin = groupAdmins
                    .map((v, i) => `${i + 1}. @${v.id.split("@")[0]}`)
                    .join("\n");

                // 5. Report/reason message
                let report = text
                    ? text.trim()
                    : "No specific report provided.";

                let txt = `🛡️ *「 Admin NotificatioN 」*\n\n`;
                txt += `👥 *Group:* ${groupName}\n`;
                txt += `💬 *Message/Report:* ${report}\n\n`;
                txt += `📋 *Admin List (${groupAdmins.length}):*\n`;
                txt += `${listAdmin}`;

                await m.react("📢");

                return await conn.sendMessage(
                    m.chat,
                    {
                        image: { url: pp },
                        caption: txt,
                        mentions: mentions
                    },
                    { quoted: m }
                );
            } catch (e) {
                console.error("[TAG ADMIN ERROR]", e);
                await m.react("❌");
                return m.reply("❌ Gagal memproses panggilan admin kumpulan.");
            }
        }
    },

    {
        command: ["groupprofile", "gprofile", "infogrup", "desc"],
        help: ["groupprofile", "desc", "gprofile"],
        tags: ["group"],
        group: true,

        exec: async (m, { sock }) => {
            try {
                const metadata = await sock.groupMetadata(m.chat);

                // Gambar profil kumpulan
                let image;

                try {
                    const ppUrl = await sock.profilePictureUrl(m.chat, "image");

                    if (ppUrl) {
                        image = { url: ppUrl };
                    }
                } catch {
                    // Tiada gambar profil
                }

                // Fallback jika gambar profil tidak tersedia
                if (!image) {
                    image = {
                        url: "https://i.ibb.co/1Z2x13T/avatar-contact.png"
                    };
                }

                const owner = metadata.owner;
                const participants = metadata.participants || [];

                const caption = [
                    "👥 *_GROUP PROFILE_*",
                    `*Nama:* ${metadata.subject || "Tidak diketahui"}`,
                    `*ID:* ${metadata.id}`,
                    `*Jumlah Ahli:* ${participants.length}`,
                    `*Pembuat:* ${owner ? `@${owner.split("@")[0]}` : "Tidak diketahui"}`,
                    ``,
                    "ℹ️ *_DESKRIPSI_*",
                    metadata.desc || "│ Tiada deskripsi",
                    ``
                ].join("\n");

                return await sock.sendMessage(
                    m.chat,
                    {
                        image,
                        caption,
                        mentions: owner ? [owner] : []
                    },
                    {
                        quoted: m
                    }
                );
            } catch (error) {
                console.error("[GROUP PROFILE ERROR]", error);

                return m.reply("Gagal mengambil maklumat profil kumpulan.");
            }
        }
    }
];
