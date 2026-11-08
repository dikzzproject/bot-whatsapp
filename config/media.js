import { downloadMediaMessage } from "@whiskeysockets/baileys";

global.stickerSettings = {
    pack: "Sticker",
    author: "By {bot}",
    quality: 70,
    full: true
};

global.renderSticker = (template, botName) => String(template ?? "").replaceAll("{bot}", botName ?? "");

global.downloadMedia = (holder, conn) =>
    downloadMediaMessage(holder, "buffer", {}, { reuploadRequest: conn.updateMediaMessage });
