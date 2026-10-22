import {downloadMediaMessage} from '@whiskeysockets/baileys';
import {Sticker, StickerTypes} from 'stickers-formatter';
import blacklist from '../assets/js/blacklist.js';

export function readSw(sock, from, msg) {
  
  if (from === "status@broadcast") {
    const emoji = ['👍', '💫', '🧢', '🙏', '😋'];
    const isEmoji = emoji[Math.floor(Math.random() * emoji.length)];
    const pembuat = msg.key.participant || msg.participant;
    
    sock.readMessages([msg.key]).then(() => {
      sock.sendMessage('status@broadcast', {
        react: {
          text: isEmoji,
          key: msg.key
          }
        }, {
          statusJidList: [pembuat]
        }).then(() => {
          console.log(`respon status: @${pembuat.split('@')[0]} react: ${isEmoji}`);
          return;
        }).catch((err) => {
          console.log(err);
        });
    }).catch(err => console.log(err));
    return;
  }
  
}

export function buatSticker(koneksi, msg, dari, type) {

  if (type !== 'notify') return;
  if (!msg.message) return;

  const msgType = Object.keys(msg.message)[0];
  const caption = msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || msg.message.conversation || msg.message.extendedTextMessage?.text || '';

  if (caption.trim() === "") return;
  
  if (caption.toLowerCase() === '!s') {

    const jenisMedia = msgType === "imageMessage" || msgType === "videoMessage";
    const reply = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const mediaReply = reply?.imageMessage || reply?.videoMessage;

    if (jenisMedia || mediaReply) {

    koneksi.sendMessage(dari, {text: 'Sedang di proses...'}, {quoted: msg});
    
    let unduhMedia;

    if (mediaReply) {
      unduhMedia = {message: reply};
    } else {
      unduhMedia = msg;
    }

      downloadMediaMessage(unduhMedia, 'buffer', {}, {reuploadRequest: koneksi.updateMediaMessage}).then(buffer => {
        return new Sticker(buffer, {
          pack: 'DikzBot',
          author: 'DikzBot',
          type: StickerTypes.FULL,
          quality: 70
        }).toBuffer();
      }).then(stickerBuffer => {
        return koneksi.sendMessage(dari, {sticker: stickerBuffer}, {quoted: msg});
      }).catch((err) => {
        console.log(err);
        koneksi.sendMessage(dari, {text: 'gagal mengubah sticker'}, {quoted: msg});
      });
    } else {
      koneksi.sendMessage(dari, {text: 'upload gambar/video dengan caption *!s*'}, {quoted: msg});
    }
  }
}
export function tagall(koneksi, dari, msg) {
  const validasi = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const text = validasi.trim().split(' ');
  const command = text[0].toLowerCase();
  
  let pesan = text.slice(1).join(' ');

  if (command === "!tagall") {
    if (blacklist.includes(dari)) {
      koneksi.sendMessage(dari, {text: "grub ini tidak diizinkan untuk menggunakan fitur itu."},{quoted: msg});
      return;
    }
    
    koneksi.groupMetadata(dari).then(peserta => {
      const daftarPeserta = peserta.participants;
      let dataPeserta = [];


      let teksTagall = `📢 *TAG ALL* 📢\n${pesan ? pesan : ''}\n`;

      daftarPeserta.forEach(daftar => {

        teksTagall += `\n@${daftar.id.split('@')[0]}`;
        dataPeserta.push(daftar.id);
      });

      koneksi.sendMessage(dari, {
        text: teksTagall,
        mentions: dataPeserta,
      }, { quoted: msg });
      console.log("ID Obrolan / Grup:", msg.key.remoteJid);

    }).catch(err => {
      console.error("Gagal mengambil metadata grup (Pastikan bot berada di dalam grup):", err);
    });
  }
}
