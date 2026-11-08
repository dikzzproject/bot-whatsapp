const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MIN_LEVEL = 1;
const MAX_LEVEL = 40;
const DEFAULT_LEVEL = 35;
const PIXEL_OFFSET = 42;

export default {
    name: "pixel",
    command: ["pixel", "pixelate"],
    tags: ["tools"],
    help: ["pixel <1-40>"],
    description: "Pikselkan gambar (balas atau hantar gambar)",
    usage: "{prefix}pixel <1-40> (balas atau hantar gambar)",
    example: "{prefix}pixel 10",
    limit: 1,
    loading: true,

    run: async (m, ctx) => {
        const source = m.media?.kind === "image" ? m.media : m.quoted?.media?.kind === "image" ? m.quoted.media : null;
        if (!source) {
            throw new UserError(
                `ℹ️ Balas atau hantar gambar dahulu.\nCara guna: ${ctx.usedPrefix}pixel <1-40>\nContoh: ${ctx.usedPrefix}pixel 10`
            );
        }

        const level = ctx.args[0] ? Number(ctx.args[0]) : DEFAULT_LEVEL;
        if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
            throw new UserError(`❌ Tahap piksel mesti nombor bulat antara ${MIN_LEVEL} hingga ${MAX_LEVEL}.`);
        }

        if (Number(source.node.fileLength ?? 0) > MAX_INPUT_BYTES) {
            throw new UserError("❌ Gambar terlalu besar. Had maksimum 10 MB.");
        }

        if (!Jimp) throw new UserError("❌ Pakej jimp belum dipasang. Jalankan: npm install");

        const buffer = await downloadMedia(source, ctx.conn);
        if (!buffer?.length) throw new UserError("❌ Gagal memuat turun gambar. Cuba hantar semula.");

        const image = await Jimp.read(buffer);
        image.pixelate(PIXEL_OFFSET - level);
        const output = await image.getBuffer("image/jpeg");

        return ctx.conn.sendMessage(
            m.chat,
            { image: output, caption: `✨ *Pikselasi siap* (tahap ${level})` },
            { quoted: m }
        );
    }
};
