import sharp from "sharp";

// Helper function to download image buffer from message (quoted or direct)
async function getImageBuffer(m) {
    const target = m.quoted ? m.quoted : m;
    if (!/image/.test(target.mimetype || "")) {
        m.reply("Reply or send an image to edit.");
    }
    return await target.download();
}

let handler = async (m, { conn, command, args }) => {
    try {
        const buffer = await getImageBuffer(m);
        let img = sharp(buffer);

        switch (command) {
            case "resize": {
                const [w, h] = (args[0] || "500x500").split("x").map(Number);
                if (!w) return m.reply("Contoh: .resize 500x500");
                img = img.resize(w, h || w);
                break;
            }
            case "crop": {
                const [w, h] = (args[0] || "500x500").split("x").map(Number);
                if (!w) return m.reply("Contoh: .crop 500x500");
                img = img.resize(w, h, { fit: "cover", position: "center" });
                break;
            }
            case "blur":
                img = img.blur(Number(args[0]) || 5);
                break;
            case "gray":
                img = img.grayscale();
                break;
            case "invert":
                img = img.negate();
                break;
            case "rotate":
                img = img.rotate(Number(args[0]) || 90);
                break;
        }

        await m.react("⏳");
        const result = await img.jpeg().toBuffer();
        await m.react("✅");

        return await conn.sendMessage(m.chat, { image: result }, { quoted: m });
    } catch (e) {
        console.error("[IMAGE EDIT ERROR]", e);
        await m.react("❌");
        return m.reply(`❌ Ralat: ${e.message || e}`);
    }
};

handler.help = ["resize", "crop", "blur", "gray", "invert", "rotate"];
handler.command = /^(resize|crop|blur|gray|invert|rotate)$/i;
handler.tags = ["tools"];
handler.limit = true;

export default handler;