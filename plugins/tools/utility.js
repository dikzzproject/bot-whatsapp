import axios from "axios";
import QRCode from "qrcode";
import { UserError } from "#lib/errors.js";
import { isUrl, toUserJid } from "#lib/utils.js";

const SAFE_MATH = /^[0-9+\-*/().%\s^]+$/;

function calculate(expression) {
    const cleaned = expression.replace(/[x×]/gi, "*").replace(/÷/g, "/").replace(/\^/g, "**");
    if (!SAFE_MATH.test(cleaned.replace(/\*\*/g, "^"))) throw new UserError("Hanya nombor dan operator + - * / ( ) % ^ dibenarkan.");
    const result = Function(`"use strict"; return (${cleaned})`)();
    if (typeof result !== "number" || !Number.isFinite(result)) throw new UserError("Pengiraan tidak sah.");
    return result;
}

export default [
    {
        command: ["kalkulator", "calc", "kira"],
        help: ["kalkulator <soalan>"],
        tags: ["tools"],
        needText: true,
        example: "{prefix}kalkulator 12*(3+4)",
        exec: (m, { text }) => m.reply(`🧮 ${text} = *${calculate(text)}*`)
    },
    {
        command: ["base64", "b64"],
        help: ["base64 <enc|dec> <teks>"],
        tags: ["tools"],
        needText: true,
        exec: (m, { args }) => {
            const mode = args.shift()?.toLowerCase();
            const content = args.join(" ");
            if (!["enc", "dec"].includes(mode) || !content) throw new UserError("Guna: .base64 enc <teks> atau .base64 dec <teks>");
            return m.reply(mode === "enc" ? Buffer.from(content).toString("base64") : Buffer.from(content, "base64").toString("utf8"));
        }
    },
    {
        command: ["qrcode", "qr"],
        help: ["qrcode <teks>"],
        tags: ["tools"],
        needText: true,
        exec: async (m, { sock, text }) => {
            const image = await QRCode.toBuffer(text, { margin: 2, width: 500 });
            return sock.sendMessage(m.chat, { image, caption: "✅ Kod QR siap" }, { quoted: m });
        }
    },
    {
        command: ["translate", "terjemah", "tr"],
        help: ["translate <kod bahasa> <teks>"],
        tags: ["tools"],
        limit: 1,
        exec: async (m, { args, prefix }) => {
            const first = args[0] ?? "";
            const hasLang = /^[a-z]{2}(-[a-z]{2})?$/i.test(first);
            const lang = hasLang ? first.toLowerCase() : "ms";
            const source = (hasLang ? args.slice(1).join(" ") : args.join(" ")) || m.quoted?.text;
            if (!source) throw new UserError(`Guna: ${prefix}translate en Selamat pagi`);

            const { data } = await axios.get("https://translate.googleapis.com/translate_a/single", {
                params: { client: "gtx", sl: "auto", tl: lang, dt: "t", q: source },
                timeout: 15000
            });
            const result = data?.[0]?.map(part => part[0]).join("") ?? "";
            return m.reply(`🌐 *${lang.toUpperCase()}*\n${result}`);
        }
    },
    {
        command: ["getpp", "pp"],
        help: ["getpp [@tag]"],
        tags: ["tools"],
        exec: async (m, { sock, text }) => {
            const target = m.target || (/^\d{8,15}$/.test(text) ? toUserJid(text) : m.sender);
            try {
                const url = await sock.profilePictureUrl(target, "image");
                return sock.sendMessage(m.chat, { image: { url }, caption: `Gambar profil @${target.split("@")[0]}`, mentions: [target] }, { quoted: m });
            } catch {
                throw new UserError("Pengguna tiada gambar profil atau ia disembunyikan.");
            }
        }
    },
    {
        command: ["ssweb", "screenshot"],
        help: ["ssweb <url>"],
        tags: ["tools"],
        limit: 1,
        needText: true,
        exec: async (m, { sock, text }) => {
            if (!isUrl(text)) throw new UserError("Pautan mesti bermula dengan http:// atau https://");
            const url = `https://image.thum.io/get/width/1280/crop/800/noanimate/${text}`;
            return sock.sendMessage(m.chat, { image: { url }, caption: text }, { quoted: m });
        }
    },
    {
        command: ["del", "delete", "padam"],
        help: ["del"],
        tags: ["tools"],
        exec: async (m, { sock, isAdmin, isOwner, isBotAdmin }) => {
            if (!m.quoted) throw new UserError("Balas mesej yang mahu dipadam.");
            const mine = m.quoted.fromMe;
            if (!mine && !(m.isGroup && isBotAdmin && (isAdmin || isOwner))) {
                throw new UserError("Saya hanya boleh memadam mesej saya sendiri (atau mesej ahli jika saya admin).");
            }
            return sock.sendMessage(m.chat, { delete: m.quoted.key });
        }
    },
    {
        command: ["quoted", "q"],
        help: ["quoted"],
        tags: ["tools"],
        exec: (m, { sock }) => {
            if (!m.quoted) throw new UserError("Balas mesej yang mahu dihantar semula.");
            return m.quoted.text ? m.reply(m.quoted.text) : m.quoted.forward();
        }
    }
];
