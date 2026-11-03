import { toMp3, toPng, toVoiceNote } from "#lib/ffmpeg.js";
import { createSticker } from "#lib/sticker.js";
import { UserError } from "#lib/errors.js";

const download = async m => {
    const buffer = await m.mediaSource.download();
    if (!buffer?.length) throw new UserError("Gagal memuat turun media.");
    return buffer;
};

const extensionOf = m => (m.mediaSource.mimetype.split("/")[1] ?? "bin").split(";")[0];

export default [
    {
        command: ["sticker", "s", "stiker"],
        help: ["sticker"],
        tags: ["tools"],
        media: ["image", "video"],
        description: "Tukar gambar atau video kepada pelekat",
        exec: async (m, { sock, text }) => {
            const [pack, author] = text.split("|").map(item => item?.trim());
            const buffer = await download(m);
            const sticker = await createSticker(buffer, { ...(pack ? { pack } : {}), ...(author ? { author } : {}) });
            return sock.sendMessage(m.chat, { sticker: sticker }, { quoted: m });
        }
    },
    {
        command: ["toimg", "toimage"],
        help: ["toimg"],
        tags: ["tools"],
        media: ["sticker"],
        exec: async (m, { sock }) => {
            const image = await toPng(await download(m));
            return sock.sendMessage(m.chat, { image, caption: "✅ Selesai" }, { quoted: m });
        }
    },
    {
        command: ["tomp3", "toaudio"],
        help: ["tomp3"],
        tags: ["tools"],
        media: ["video", "audio"],
        limit: 1,
        exec: async (m, { sock }) => {
            await m.reply("⏳ Menukar kepada audio...");
            const audio = await toMp3(await download(m), extensionOf(m));
            return sock.sendMessage(m.chat, { audio, mimetype: "audio/mpeg" }, { quoted: m });
        }
    },
    {
        command: ["tovn", "tovoice"],
        help: ["tovn"],
        tags: ["tools"],
        media: ["video", "audio"],
        limit: 1,
        exec: async (m, { sock }) => {
            await m.reply("⏳ Menukar kepada nota suara...");
            const audio = await toVoiceNote(await download(m), extensionOf(m));
            return sock.sendMessage(m.chat, { audio, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: m });
        }
    }
];
