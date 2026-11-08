import * as ffmpeg from "#lib/ffmpeg.js";
import { createSticker } from "#lib/sticker.js";
import "#lib/registry.js";
import "#lib/wizard.js";
import "#lib/botconfig.js";
import "#lib/plugins.js";

global.ffmpeg = ffmpeg;
global.createSticker = createSticker;

const optional = async name => {
    try {
        const module = await import(name);
        return module.default ?? module;
    } catch {
        return null;
    }
};

global.Jimp = await import("jimp").then(module => module.Jimp).catch(() => null);

global.ytdl = await optional("yt-downld");
global.yts = await optional("yt-search");
