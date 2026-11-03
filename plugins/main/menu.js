import { randomImage } from "#lib/media.js";
import { buildAll, buildCategory, buildHeader, buildOverview } from "#lib/menu.js";

const CAPTION_LIMIT = 1000;

async function sendMenu(m, ctx, body) {
    const header = buildHeader(ctx);
    const full = `${header}\n\n${body}`;
    const image = randomImage();

    if (!image) return m.reply(full);

    if (full.length <= CAPTION_LIMIT) {
        return ctx.sock.sendMessage(m.chat, { image, caption: full }, { quoted: m });
    }

    await ctx.sock.sendMessage(m.chat, { image, caption: header }, { quoted: m });
    return m.reply(body);
}

export default {
    command: ["menu", "allmenu", "help", "?"],
    help: ["menu", "menu <kategori>", "allmenu"],
    tags: ["main"],
    description: "Paparkan senarai arahan",
    exec: async (m, ctx) => {
        const { command, text, prefix } = ctx;
        const wantAll = command === "allmenu" || /^(all|semua)$/i.test(text);
        if (wantAll) return sendMenu(m, ctx, buildAll(prefix));

        if (text) {
            const section = buildCategory(text.split(/\s+/)[0], prefix);
            if (!section) return m.reply(`Kategori "${text}" tidak dijumpai. Taip ${prefix}menu untuk senarai kategori.`);
            return sendMenu(m, ctx, section);
        }
        return sendMenu(m, ctx, buildOverview(prefix));
    }
};
