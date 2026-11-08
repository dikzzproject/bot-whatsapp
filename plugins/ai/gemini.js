import { GoogleGenAI } from "@google/genai";

// Pastikan API Key telah diletakkan dalam global.apikey.gemini atau process.env
const apiKey = config.apikey?.gemini.api || process.env.API_GEMINI;
const modelApi = config.apikey?.gemini.model || "gemini-3.5-flash-lite";

export default {
    name: "ai-gemini",
    command: ["gemini", "ai"],
    tags: ["ai"],
    help: ["gemini <text>", "ai <reply image/video/text>"],
    limit: true,
    react: "⚙️",

    run: async (m, { conn, text, usedPrefix, command }) => {
        try {
            if (!apiKey) {
                return m.reply("❌ Kunci API Gemini belum ditetapkan.");
            }

            // Membaca media jika pengguna membalas (reply) imej atau video
            let q = m.quoted ? m.quoted : m;
            let mime = (q.msg || q).mimetype || "";
            let promptText = text
                ? text
                : m.quoted && (m.quoted.text || m.quoted.caption)
                  ? m.quoted.text || m.quoted.caption
                  : "";

            if (!promptText && !mime) {
                return m.reply(`*Penggunaan:* ${usedPrefix}${command} <query or reply image/video>\n\n*Contoh:* ${usedPrefix}${command} who make gemini ai?`);
            }

            await conn.sendPresenceUpdate("composing", m.chat);

            const ai = new GoogleGenAI({ apiKey: apiKey });
            let response;

            // Jika mesej mengandungi Imej atau Video (Multimodal Mode)
            if (/(image|video)/.test(mime)) {
                let mediaBuffer = await q.download();
                let base64Data = mediaBuffer.toString("base64");
                let cleanMime = mime.split(";")[0];

                let defaultPrompt = /image/.test(mime)
                    ? "Describe this image in detail."
                    : "Analyze and describe what happens in this video in detail.";

                response = await ai.models.generateContent({
                    model: modelApi,
                    contents: [
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: cleanMime
                            }
                        },
                        promptText || defaultPrompt
                    ]
                });
            } else {
                // Mod Teks Biasa
                response = await ai.models.generateContent({
                    model: modelApi,
                    contents: promptText
                });
            }

            let result = response.text;
            if (!result) {
                return m.reply("❌ Tiada respons diterima daripada AI.");
            }

            return m.reply(
                "*✨ G E M I N I • A S I S T E N T ✨*\n\n" + result.trim()
            );
        } catch (e) {
            console.error("[GEMINI ERROR]", e);
            return m.reply(
                `❌ Gagal memproses permintaan AI: ${e.message || e}`
            );
        }
    }
};
