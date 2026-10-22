import {downloadMediaMessage} from '@whiskeysockets/baileys';
import prism from 'prism-media';
export default function tomp3(sock) {
  sock.ev.on('messages.upsert', ({messages}) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.isHistory) return;
    
    const Jid = msg.key.remoteJid;
    const grub = Jid.endsWith('@g.us');
    if (!grub) return;

    const pesan = (msg.message?.conversation || 
                     msg.message?.extendedTextMessage?.text || 
                     msg.message?.videoMessage?.caption || '').toLowerCase().trim();

    if (grub && pesan.startsWith('!tomp3')) {
      const reply = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const mediaMsg = reply ? {message: reply} : msg;
      const isVideo = msg.message?.videoMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
      
      sock.sendMessage(Jid, {text: 'Diproses! mohon tunggu...'},{quoted: msg});
      if (!isVideo) return sock.sendMessage(Jid, {text: 'kirim/reply video yang ingin di konvert dengan komentar *!tomp3*'},{quoted: msg});
      
      downloadMediaMessage(mediaMsg, 'buffer', {}).then(vBuff => {
        const tr = new prism.FFmpeg({args: ['-i', 'pipe:0', '-vn', '-f', 'mp3']});
        tr.end(vBuff);
        
        const chunk = [];
        tr.on('data', C => chunk.push(C))
        .on('end', () => sock.sendMessage(Jid, {audio: Buffer.concat(chunk), mimetype: 'audio/mp4'},{quoted: msg}))
        .on('error', () => sock.sendMessage(Jid, {text: 'gagal mengkonvert menjadi audio!'},{quoted: msg}));
      }).catch((err) => {
        console.log(err);
        sock.sendMessage(Jid, {text: 'Gagal mendownload media!'},{quoted: msg});
      });
    }
  });
}