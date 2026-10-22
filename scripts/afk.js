const afk = {};
export default function userAFK(sock) {
  const myId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  sock.ev.on('messages.upsert', ({messages}) => {
    const msg = messages[0];
    if (!msg || !msg.message) return;

    const me = msg.key.fromMe;

    const chatId = msg.key.remoteJid;
    //const id = msg.key.participant || msg.key.remoteJid;
    const pesan = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
    const pesanLower = pesan.toLowerCase();
    const grub = chatId.endsWith('@g.us');

    if (me && (msg.key.id.startsWith('BAE5') || msg.key.id.startsWith('3EB0') || msg.key.id.length === 16)) {
      return; 
    }

    if (pesanLower.startsWith('!afk')) {
      const alasan = pesan.split('') || 'Sibuk';
      afk[myId] = alasan;
    }
    if (afk[myId]) {
      sock.sendMessage(chatId, {
        text: `anda selesai afk` },{
        quoted: msg
      });
      delete afk[myId];
    }
  });
}