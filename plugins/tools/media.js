const resolveMedia = m => m.media ?? m.quoted?.media ?? null;

function requireMedia(m, ctx, allowed = null) {
    const media = resolveMedia(m);
    const { usage, example } = ctx.plugin;
    const hint = `${usage ? `\nCara guna: ${usage}` : ""}${example ? `\nContoh: ${example}` : ""}`
        .replaceAll("{prefix}", ctx.usedPrefix);

    if (!media) throw new UserError(`ℹ️ Balas atau hantar media dahulu.${hint}`);
    if (allowed && !allowed.includes(media.kind)) {
        throw new UserError(`Jenis media tidak disokong. Diterima: ${allowed.join(", ")}.${hint}`);
    }
    return media;
}

async function fetchMedia(conn, media) {
    const buffer = await downloadMedia({ key: media.key, message: media.message }, conn).catch(() => null);
    if (!buffer?.length) throw new UserError("Gagal memuat turun media. Cuba hantar semula media itu.");
    return buffer;
}

const extOf = node => (String(node.mimetype || "").split("/")[1] || "bin").split(";")[0];

async function makeSticker(m, ctx) {
    const media = requireMedia(m, ctx, ["image", "video", "sticker"]);
    const buffer = await fetchMedia(ctx.conn, media);

    const custom = ctx.text.includes("|") ? ctx.text.split("|").map(part => part.trim()) : null;
    const pack = custom?.[0] || renderSticker(stickerSettings.pack, ctx.bot.name);
    const author = custom ? custom[1] ?? "" : renderSticker(stickerSettings.author, ctx.bot.name);

    const sticker = await createSticker(buffer, {
        pack,
        author,
        full: stickerSettings.full,
        quality: stickerSettings.quality
    });
    return ctx.conn.sendMessage(m.chat, { sticker }, { quoted: m });
}

async function readMedia(m, ctx) {
    const media = requireMedia(m, ctx);
    const buffer = await fetchMedia(ctx.conn, media);
    const caption = media.node.caption ?? "";
    const label = media.viewOnce ? "👁️ View once dibaca" : "📥 Media dibaca";
    const body = caption ? `${label}\n${caption}` : label;

    const content = {
        image: () => ({ image: buffer, caption: body }),
        video: () => ({ video: buffer, caption: body }),
        audio: () => ({ audio: buffer, mimetype: media.node.mimetype || "audio/mpeg", ptt: Boolean(media.node.ptt) }),
        sticker: () => ({ sticker: buffer }),
        document: () => ({
            document: buffer,
            mimetype: media.node.mimetype || "application/octet-stream",
            fileName: media.node.fileName || "fail"
        })
    }[media.kind]();

    return ctx.conn.sendMessage(m.chat, content, { quoted: m });
}

export default [
    {
        command: ["sticker", "s", "stiker"],
        help: ["sticker", "s", "s <pack|author>"],
        tags: ["tools"],
        description: "Tukar gambar, video atau stiker kepada pelekat (termasuk view once)",
        usage: "{prefix}s [pack|author] (balas gambar, video atau stiker)",
        example: "{prefix}s Nama Pack|Nama Author",
        loading: false,
        run: (m, ctx) => makeSticker(m, ctx)
    },
    {
        command: ["toimg", "toimage", "img"],
        help: ["toimg"],
        tags: ["tools"],
        description: "Tukar stiker kepada gambar (gambar dibiarkan sama)",
        usage: "{prefix}toimg (balas stiker atau gambar)",
        example: "{prefix}toimg",
        loading: false,
        run: async (m, ctx) => {
            const media = requireMedia(m, ctx, ["sticker", "image"]);
            const buffer = await fetchMedia(ctx.conn, media);
            const image = media.kind === "image" ? buffer : await ffmpeg.toPng(buffer, "webp");
            return ctx.conn.sendMessage(m.chat, { image, caption: "✅ Selesai" }, { quoted: m });
        }
    },
    {
        command: ["tomp3", "toaudio"],
        help: ["tomp3"],
        tags: ["tools"],
        usage: "{prefix}tomp3 (balas video atau audio)",
        example: "{prefix}tomp3",
        limit: 1,
        loading: false,
        run: async (m, ctx) => {
            const media = requireMedia(m, ctx, ["video", "audio"]);
            const buffer = await fetchMedia(ctx.conn, media);
            const audio = await ffmpeg.toMp3(buffer, extOf(media.node));
            return ctx.conn.sendMessage(m.chat, { audio, mimetype: "audio/mpeg" }, { quoted: m });
        }
    },
    {
        command: ["tovn", "tovoice"],
        help: ["tovn"],
        tags: ["tools"],
        usage: "{prefix}tovn (balas video atau audio)",
        example: "{prefix}tovn",
        limit: 1,
        loading: false,
        run: async (m, ctx) => {
            const media = requireMedia(m, ctx, ["video", "audio"]);
            const buffer = await fetchMedia(ctx.conn, media);
            const audio = await ffmpeg.toVoiceNote(buffer, extOf(media.node));
            return ctx.conn.sendMessage(m.chat, { audio, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: m });
        }
    },
    {
        command: ["vo", "readvo", "viewonce"],
        help: ["vo"],
        tags: ["tools"],
        description: "Baca view once atau media, hantar semula sebagai media biasa",
        usage: "{prefix}vo (balas view once atau media)",
        example: "{prefix}vo",
        loading: false,
        run: readMedia
    }
];
