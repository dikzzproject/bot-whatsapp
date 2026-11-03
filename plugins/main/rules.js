import { randomImage } from "#lib/media.js";

export default {
    help: ["rules", "peraturan"],
    tags: ["main", "info"],
    command: ["rules", "peraturan", "rule"],

    exec: async (m, { sock }) => {
        const rules = `
📜 *PERATURAN PENGGUNAAN BOT WHATSAPP* 📜
━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🚫 **Dilarang Spam**: Jangan membuat panggilan (*call*), pesanan bertubi-tubi, atau spam arahan (*command*).
2. 🔞 **Kandungan NSFW / 18+**: Dilarang sama sekali meminta atau menghantar bahan pornografi atau imej sensitif.
3. 🛑 **Hormati Ahli & Admin**: Dilarang menggunakan kata-kata kesat, menghina, atau menyebarkan kebencian (*hate speech*).
4. 📢 **Dilarang Iklan / Promosi**: Dilarang menyebar pautan (*link*) kumpulan atau promosi tanpa kebenaran admin.
5. ⚠️ **Sekatan Akaun**: Kegagalan mematuhi peraturan akan menyebabkan nombor anda di-**block** atau di-**ban** secara automatik daripada menggunakan bot.

━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 *${config.bot.name || "Bot Whatsapp"}*
`.trim();

        const imageUrl = "https://files.catbox.moe/example.jpg"; 

        return sock.sendFile(m.chat, randomImage(), {
            caption: rules,
            quoted: m
        });
    }
};
