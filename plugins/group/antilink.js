const LINK_PATTERN = /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/i;

export default {
    before: async (m, { sock, group, isAdmin, isOwner, isBotAdmin }) => {
        if (!m.isGroup || !group?.antilink || m.fromMe) return false;
        if (isAdmin || isOwner || !LINK_PATTERN.test(m.text)) return false;

        if (!isBotAdmin) return false;
        await sock.sendMessage(m.chat, { delete: m.key });
        await m.reply(`🚫 @${m.number} dilarang menghantar pautan kumpulan.`, { mentions: [m.sender] });
        return true;
    }
};
