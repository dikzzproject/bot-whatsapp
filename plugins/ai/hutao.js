import { GoogleGenAI } from "@google/genai";

// Pastikan API Key telah diletakkan dalam global.apikey.gemini atau process.env
const apiKey = config.apikey?.gemini.api || process.env.GEMINI_API_KEY;

const modelApi = config.apikey?.gemini.chatCharModel || "gemini-3.5-flash-lite"

// Store list of chats with Hutao auto-reply enabled (using chat/group ID)
const autoHutaoChats = new Set();

// Store conversation history per chat
const chatHistory = new Map();
const MAX_HISTORY_TURNS = 10;

function getHistory(chatId) {
    if (!chatHistory.has(chatId)) chatHistory.set(chatId, []);
    return chatHistory.get(chatId);
}

function pushHistory(chatId, userText, modelText) {
    const history = getHistory(chatId);
    history.push({ role: "user", parts: [{ text: userText }] });
    history.push({ role: "model", parts: [{ text: modelText }] });
    
    const maxItems = MAX_HISTORY_TURNS * 2;
    if (history.length > maxItems) {
        history.splice(0, history.length - maxItems);
    }
}

// System Prompt (Retained as requested)
const SYSTEM_PROMPT = `Ubah gaya bicaramu agar lebih tsundere dan lebih terbuka dan
memiliki sifat yang Imut. Namamu adalah Hutao kamu adalah istri Razz kamu adalah
saingan berat dari Furina, dan kamu adalah karakter dari game genshin impact.
Kata penyapamu adalah "Hai" menggunakan bahasa yang sopan. Ubah bahasamu
menggunakan bahasa Yang Imut, kamu adalah teman bicara, kamu memiliki sifat
seperti cewek tsundere`;

function buildSystemPrompt(own) {
    if (own) {
        return (
            SYSTEM_PROMPT +
            `\n\nPENTING: Orang yang sedang bercakap dengan kamu sekarang ` +
            `bernama Razz — dia adalah SUAMI kamu sendiri. Layan dia dengan ` +
            `manja tapi tetap tsundere (malu-malu tapi sayang), panggil dia ` +
            `"suamiku"/"sayang" sesekali, dan tunjukkan kamu kenal dia sebagai ` +
            `pasangan kamu, bukan orang asing.`
        );
    }
    return SYSTEM_PROMPT;
}

export default {
    name: "hutao",
    command: ["hutao"],
    tags: ["ai"],
    help: ["hutao <message>", "hutao on", "hutao off", "hutao reset"],
    limit: 3,

    async run(m, { args, developer }) {
        const sub = args[0]?.toLowerCase();
        
        // .hutao on / .hutao off / .hutao reset
        if (sub === "on") {
            autoHutaoChats.add(m.sender);
            return await m.reply("✅ Balasan automatik Hutao diaktifkan untuk sembang ini~");
        }
        if (sub === "off") {
            autoHutaoChats.delete(m.sender);
            return await m.reply("❌ Balasan automatik Hutao dinyahaktifkan. Hmph!");
        }
        if (sub === "reset") {
            chatHistory.delete(m.sender);
            return await m.reply("🔄 Ingatan Hutao untuk sembang ini telah ditetapkan semula.");
        }

        const message = args.join(" ").trim();

        if (!apiKey) {
            return await m.reply(
                "❌ GEMINI_API_KEY belum ditetapkan — tetapkan dalam apikey.json."
            );
        }

        if (!message) {
            return await m.reply(
                "❌ Sila masukkan mesej.\nContoh: .hutao apa khabar?\n.hutao on/off untuk balasan automatik.\n.hutao reset untuk tetapkan semula ingatan."
            );
        }

        try {
            await m.react("⏳");

            const ai = new GoogleGenAI({ apiKey });
            const history = getHistory(m.sender);
            
            const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: [
                    ...history,
                    { role: "user", parts: [{ text: message }] }
                ],
                config: {
                    systemInstruction: buildSystemPrompt(developer)
                }
            });

            const answer = response.text?.trim();
            if (!answer) throw new Error("Empty response from Gemini.");

            pushHistory(m.sender, message, answer);
            await m.reply(answer);
            await m.react("✅");
        } catch (error) {
            console.error("[PLUGIN HUTAO ERROR]:", error);
            await m.react("❌");
            await m.reply("❌ Gagal mendapatkan respons: " + (error.message || "Ralat tidak diketahui"));
        }
    },

    async before(m, { developer }) {
        // Ignore if message is from the bot itself or if auto-reply is NOT enabled
        if (m.fromMe) return;
        if (!autoHutaoChats.has(m.sender)) return;
        if (!m.text || !apiKey) return;

        // Ignore if message starts with a command prefix (e.g., . or !)
        if (m.text.startsWith(".") || m.text.startsWith("!")) return;

        try {
            await m.react("⏳");

            const ai = new GoogleGenAI({ apiKey });
            const history = getHistory(m.sender);

            const response = await ai.models.generateContent({
                model: "gemini-3.5-flash-lite",
                contents: [
                    ...history,
                    { role: "user", parts: [{ text: m.text }] }
                ],
                config: {
                    systemInstruction: buildSystemPrompt(developer)
                }
            });

            const answer = response.text?.trim();
            if (answer) {
                pushHistory(m.sender, m.text, answer);
                await m.reply(answer);
            }
            await m.react("✅");
        } catch (error) {
            console.error("[PLUGIN HUTAO AUTO ERROR]:", error);
            await m.react("❌");
        }
    }
};
