export default {
    commands: ["broadcast", "bc"],
    group: false,
    exec: async (msg, { sock, args, text }) => {
        if (!text) {
            return msg.reply(`Sila masukkan teks untuk disiarkan!\nContoh: *${msg.text.split(' ')[0]} Halo semua*`);
        }

        await msg.reply(`Sedang memproses broadcast...`);
        msg.reply(text)
    }
};
