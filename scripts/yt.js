import ytdl from 'ytdl-core';

export default function youtube(sock, ) {
  sock.ev.on('messages.upsert', ({messages}) => {
    const msg = messages[0];
    if (!msg.message || msg.isHistory) return;
    
    const id = msg.key.remoteJid;
    const grub = id.endsWith('@g.us');

    const pesan = msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text || '';
    
    if (grub) {
      if (pesan.startsWith('!ytmp3')) {
        const link = pesan.slice(1).trim();
        if (!ytdl.validateUrl(link)) return sock.sendMessage(id, {text: 'Url tidak valid!'},{quoted: msg});

        ytdl.getInfo(url).then(info => {
          if (Number(info.videoDetails.lengthSeconds) > 300) {
            return sock.sendMessage(id, {text: 'Video terlalu panjang, durasi maksimal 5 menit.'},{quoted: msg});
          }

          const file = `./tmp_${Date.now()}.mp3`;
          const type = {filter: (f) => f.hasAudio && !f.hasVideo && !f.container === 'mp4'};

          return new Promise((resolve, reject) => {
            const stream = ytdl.downloadFromInfo(info, type);
            stream.on('error', reject);
            stream.pipe(fs.createWriteStream(file)).on('finish', resolve).on('error', reject);
          });
          
          
        }).catch((err) => {
          sock.sendMessage(id, {text: 'Gagal mendownload media!'},{quoted: msg});
          console.log(err);
        })
      }
    }
  });
}