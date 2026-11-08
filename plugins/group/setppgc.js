import * as JimpModule from 'jimp'
const { Jimp, JimpMime, ResizeStrategy } = JimpModule

const handler = async (m, { conn }) => {
    try {
        const q = m.quoted ? m.quoted : m;
        let mime = (q.msg || q).mimetype || "";

        if (!/image/.test(mime))
            return m.reply(`📸 Mana gambarnya? Balas pada gambar.`);

        const group = m.chat;

        let media = await q.download();
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
                target: group,
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

        m.reply(`Gambar profil kumpulan dikemas kini ✅`);
    } catch (e) {
        await m.reply("*[ERROR]* Balas imej untuk menukar gambar profil kumpulan!");
    }
};

handler.help = ["setppgc"];
handler.tags = ["group"];
handler.command = /^(setppgc|setppgrup|setppgroup)$/i;

handler.group = true;
handler.admin = true;
handler.botAdmin = true;

export default handler;