export default {
    commands: ["broadcast", "bc"],
    
    // Validasi tambahan (otomatis dicek oleh handler utama kita)
    owner: true,      // Hanya bisa dipakai oleh nomor yang terdaftar di global.owner
    group: false,     // Bisa dipakai di chat pribadi maupun grup
    
    execute: async (msg, { sock, args, text }) => {
        if (!text) {
            return msg.reply(`Sila masukkan teks untuk disiarkan!\nContoh: *${msg.text.split(' ')[0]} Halo semua*`);
        }

        await msg.reply(`Sedang memproses broadcast...`);
        // Logika broadcast Anda di sini...
    }
};
