import config from "#config/global.js";

export async function createSticker(buffer, { pack = config.bot.name, author = config.owner.name, full = true, quality = 70 } = {}) {
    const { Sticker, StickerTypes } = await import("stickers-formatter");
    return new Sticker(buffer, {
        pack,
        author,
        type: full ? StickerTypes.FULL : StickerTypes.CROPPED,
        quality
    }).toBuffer();
}
