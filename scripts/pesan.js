export default function ping(sock, remoteJid, msg) {
  if (!msg || msg.isHistory) return;
  const pesan = msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text || '';
  
  if (pesan === "!ping") {
    const waktuPesan = msg.messageTimestamp * 1000;
    const hasil = (Date.now() - waktuPesan) / 1000;
    sock.sendMessage(
      remoteJid,
      {text: `*Pong!*  ${hasil.toFixed(2)}s`},
      {quoted: msg}
    );
    console.log('id pesan: ', remoteJid);
  }
}

export function menu(sock, remoteJid, msg) {
    if (!msg || msg.isHistory) return;
  const pesan = msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text || '';
  const grub = remoteJid.endsWith('@g.us');

  if (!grub) return;
  
  if (grub && pesan === '!menu') {
    sock.sendMessage(
      remoteJid,
      {text: `
╔══════════════════════╗
─── MAIN MENU DASHBOARD ───
╚══════════════════════╝ 

Hi! Selamat datang di panel kontrol utama. Silakan gunakan perintah di bawah ini sesuai kebutuhan Anda. 

╭──────────────────────◇
│ ⚙️ MAIN MENU
├──────────────────────
│ ⊙ !menu ⁃ Dashboard menu
│ ⊙ !ping ⁃ Cek kecepatan respon bot
│ ⊙ !owner ⁃ Hubungi developer / admin | *(maintenance)*
╰──────────────────────◇ 

╭──────────────────────◇
│ 👥 GROUP UTILITIES (Khusus Grup)
├──────────────────────
│ ⊙ !tagall ⁃ Tag semua member
│ ⊙ !infogrup ⁃ Detail grup | *(maintenance)*
│ ⊙ !open ⁃ Buka grub chat
│ ⊙ !close ⁃ Tutup grub chat
│ ⊙ !kick ⁃ Keluarkan member
╰──────────────────────◇ 

╭──────────────────────◇
│ 🛠️ TOOLS
├──────────────────────
│ ⊙ !s ⁃ Konversi gambar ke stiker
│ ⊙ !tomp3 ⁃ Konvert mp4 to mp3
│ ⊙ !download ⁃ Unduh video | *(maintenance)*
│ ⊙ !profile ⁃ Lihat detail akun | *(maintenance)*
╰──────────────────────◇ 

────────────────────────────────
Bot sedang dalam proses pengembangan.
Saran fitur? Hubungi +6285111509070
────────────────────────────────
      `},
      {quoted: msg}
    );
  }

}