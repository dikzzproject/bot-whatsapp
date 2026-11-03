import axios from "axios";
import TTLCache from "#lib/cache.js";
import { UserError } from "#lib/errors.js";

const cache = new TTLCache({ ttl: 30 * 60 * 1000, max: 100 });
const TIKTOK_URL = /https?:\/\/(?:[\w-]+\.)?tiktok\.com\/\S+/i;

async function fetchVideo(url) {
    const cached = cache.get(url);
    if (cached) return cached;
    const { data } = await axios.get("https://tikwm.com/api/", { params: { url }, timeout: 30000 });
    if (!data?.data?.play) throw new UserError("Video tidak dijumpai atau pautan tidak sah.");
    return cache.set(url, { video: data.data.play, audio: data.data.music, title: data.data.title ?? "" });
}

const pickUrl = (text, quoted) => (text.match(TIKTOK_URL) ?? quoted?.match(TIKTOK_URL))?.[0];

export default [
    {
        command: ["tiktok", "tt", "ttdl"],
        help: ["tiktok <pautan>"],
        tags: ["downloader"],
        limit: 1,
        cooldown: 5,
        example: "{prefix}tiktok https://vt.tiktok.com/xxxx",
        exec: async (m, { sock, text }) => {
            const url = pickUrl(text, m.quoted?.text);
            if (!url) throw new UserError("Sertakan pautan TikTok yang sah.");
            await m.react("⏳");
            const info = await fetchVideo(url);
            await sock.sendMessage(m.chat, { video: { url: info.video }, caption: info.title }, { quoted: m });
            await sock.sendMessage(m.chat, { audio: { url: info.audio }, mimetype:
            "audio/mpeg" }, { quoted: m });
            return m.react("✅");
        }
    },
    {
        command: ["ttmp3", "tiktokmp3"],
        help: ["ttmp3 <pautan>"],
        tags: ["downloader"],
        limit: 1,
        cooldown: 5,
        exec: async (m, { sock, text }) => {
            const url = pickUrl(text, m.quoted?.text);
            if (!url) throw new UserError("Sertakan pautan TikTok yang sah.");
            const info = await fetchVideo(url);
            return sock.sendMessage(m.chat, { audio: { url: info.audio }, mimetype: "audio/mpeg" }, { quoted: m });
        }
    }
];
