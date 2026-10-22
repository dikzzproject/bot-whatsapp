import blacklist from '../assets/js/blacklist.js';
export default function kick(sock) {
  sock.ev.on('messages.upsert', ({messages}) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.isHistory) return;
    
    const pesan = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase().trim();
    const chatId = msg.key.remoteJid;
    const pengirim = msg.key.participant || msg.participant || msg.key.remoteJid;
    const grub = chatId.endsWith('@g.us');

    if (!grub) return;

    if (grub && pesan.startsWith('!kick')) {
      const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (target.length === 0) {
        sock.sendMessage(chatId, {text: 'Tag anggota yang ingin di keluarkan!'},{quoted: msg});
        return;
      }
      if (blacklist.includes(pengirim)) {
        sock.sendMessage(chatId, {text: 'Anda di tidak bisa menggunakan fitur ini!'},{quoted: msg});
        return;
      }
      
      const nomorTarget = target[0];
      const bot = '6285111509070@s.whatsapp.net';
      
      if (nomorTarget.includes(bot)) {
          return sock.sendMessage(chatId, {text: 'Anda tidak bisa mengeluarkan bot dengan komentar *!kick*. Tag anggota lain.'})
      }

      sock.groupMetadata(chatId).then(metadata => {
        const daftar = metadata.participants;
        const isAdmin = daftar.find(p => p.id === pengirim);
        if (!isAdmin && (isAdmin.admin === 'admin' || isAdmin.admin === 'superadmin')) return sock.sendMessage(chatId, {text: 'Perintah ini khusus admin grub!'},{quoted: msg});
        
        sock.groupParticipantsUpdate(chatId, [nomorTarget], "remove").then(() => {
          console.log('pengguna dikeluarkan');
        }).catch((err) => {
          sock.sendMessage(chatId, {text: 'Bot bukan Admin'},{quoted: msg});
          console.log(err);
        });
      }).catch(err => console.log(err));
    }
  });
}