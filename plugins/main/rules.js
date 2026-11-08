export default {
    help: ["rules", "peraturan"],
    tags: ["main", "info"],
    command: ["rules", "peraturan", "rule"],

    exec: async (m, { sock }) => {
        const rules = `
*RULES & POLICY*
*${config.bot.name}*
━━━━━━━━━━━━

Sila baca dan fahami peraturan
sebelum menggunakan perkhidmatan bot.

━━━━━━━━━━━━━━
» 01. KONTAK & SUPPORT
━━━━━━━━━━━━━━

› Owner    : .owner
› Website  : ${config.link.web}
› Group    : ${config.link.sgc}

━━━━━━━━━━━━━━
» 02. GENERAL RULES
━━━━━━━━━━━━━━

› Dilarang menggunakan bot untuk
  aktiviti yang menyalahi undang-undang.
› Dilarang melakukan spam command.
› Dilarang menyalahgunakan fungsi bot.
› Hormati owner dan pengguna lain.
› Gunakan bahasa yang sopan.
› Dilarang mengganggu operasi bot.

━━━━━━━━━━━━━━
» 03. USAGE RESTRICTIONS
━━━━━━━━━━━━━━

› Dilarang menyebarkan berita palsu.
› Dilarang melakukan penipuan.
› Dilarang melakukan flood atau spam.
› Dilarang mengeksploitasi bug sistem.
› Berikan kredit kepada sumber asal
  apabila mengedarkan semula hasilnya.

━━━━━━━━━━━━━━
» 04. LIMIT SYSTEM
━━━━━━━━━━━━━━

› Setiap pengguna menerima limit harian.
› Limit reset pada 12:00 AM (00:00 WIB).
› Setiap command mungkin menggunakan
  jumlah limit yang berbeza.
› Limit habis bermaksud akses kepada
  fungsi berlimit perlu menunggu reset.
› Sesetengah fungsi memerlukan Premium.

━━━━━━━━━━━━━━
» 05. PREMIUM MEMBERSHIP
━━━━━━━━━━━━━━

› Premium memberikan akses kepada
  fungsi eksklusif tertentu.
› Kuota penggunaan mengikut pakej.
› Tempoh bermula selepas pengaktifan.
› Premium tidak boleh dipindah milik.
› Penyalahgunaan boleh menyebabkan
  akses ditarik balik.
› Harga boleh disemak melalui .premium.

━━━━━━━━━━━━━━
» 06. BOT RENTAL & PERMANENT
━━━━━━━━━━━━━━

› Sewaan tertakluk kepada tempoh pakej.
› Pengguna perlu memperbaharui sewaan
  sebelum tarikh tamat.
› Akses tamat boleh dinyahaktifkan.
› Permanen bermaksud akses selagi projek
  masih beroperasi.
› Akses permanen bukan jaminan seumur
  hidup pembeli.
› Sewaan terikat kepada satu ID grup.
› Maksimum 2 kali pindah grup percuma.
› Penggantian nombor akibat sekatan
  WhatsApp tertakluk kepada jaminan
  dan kemampuan owner.
› Sasaran penggantian maksimum 1 × 24 jam.
› Tiada refund selepas pengaktifan,
  tertakluk kepada undang-undang.

━━━━━━━━━━━━━━
» 07. JADIBOT / CLONE
━━━━━━━━━━━━━━

› Pengguna bertanggungjawab terhadap
  nombor WhatsApp sendiri.
› Risiko sekatan akaun tertakluk kepada
  polisi WhatsApp.
› Semua clone tertakluk kepada peraturan
  dan sistem bot utama.
› Jangan berkongsi session atau kod pairing.
› Pengguna perlu melakukan pairing semula
  jika session terputus.
› Dilarang menggunakan clone untuk spam
  atau aktiviti yang memudaratkan.
› Clone yang melanggar peraturan boleh
  dihentikan serta-merta.

━━━━━━━━━━━━━━
» 08. MAINTENANCE & SUPPORT
━━━━━━━━━━━━━━

› Bot mungkin offline pada bila-bila masa.
› Maintenance boleh dilakukan tanpa notis.
› Fungsi dan command boleh berubah.
› Laporkan bug kepada owner.
› Request fitur tertakluk kepada
  pertimbangan owner.
› Owner bukan khidmat pelanggan 24 jam.
› Sila bersabar menunggu maklum balas.

━━━━━━━━━━━━━━
» 09. PRIVACY & SECURITY
━━━━━━━━━━━━━━

› Jangan berkongsi maklumat sensitif.
› Pastikan session disimpan dengan selamat.
› Pengguna bertanggungjawab terhadap
  keselamatan akaun masing-masing.
› Data tertentu mungkin diproses untuk
  tujuan operasi bot.

━━━━━━━━━━━━━━
» 10. PENALTY & SANCTIONS
━━━━━━━━━━━━━━

› Kesalahan pertama  : Amaran.
› Kesalahan kedua    : Sekatan sementara.
› Kesalahan ketiga   : Banned permanen.
› Kesalahan berat    : Tindakan serta-merta.

Owner berhak mengambil tindakan
berdasarkan tahap kesalahan.

━━━━━━━━━━━━━━
» 11. USER AGREEMENT
━━━━━━━━━━━━━━

Dengan menggunakan ${config.owner.name}, anda
dianggap telah membaca, memahami dan
bersetuju dengan semua peraturan ini.

Kegagalan membaca peraturan bukan alasan
untuk mengelakkan tindakan yang ditetapkan.

━━━━━━━━━━━━━━
${config.owner.name} © ${new Date().getFullYear()}
━━━━━━━━━━━━━━
`.trim();

        const imageUrl = "https://files.catbox.moe/example.jpg";

        return sock.sendMessage(
            m.chat,
            {
                image: thumbnail().buffer,
                caption: rules
            },
            { quoted: m }
        );
    }
};
