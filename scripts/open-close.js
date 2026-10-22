export default function gcSetting(sock) {
  sock.ev.on('messages.upsert', ({messages}) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.isHistory) return;
    
    const Jid = msg.key.remoteJid;
    const grub = Jid.endsWith('@g.us');
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const pesan = text.toLowerCase().trim();

    if (grub && pesan.startsWith('!close')) {
      sock.groupSettingUpdate(Jid, 'announcement').then(() => {
        sock.sendMessage(Jid, {
          text: 'Grub ditutup!'
        },{
          quoted: msg
        });
      }).catch(err => console.log(err));
    }
    
    if (pesan.startsWith('!open')) {
      sock.groupSettingUpdate(Jid, 'not_announcement').then(() => {
        sock.sendMessage(Jid, {
          text: 'Grub dibuka!'
        },{
          quoted: msg
        });
      }).catch(err => console.log(err));
    }
  });
}