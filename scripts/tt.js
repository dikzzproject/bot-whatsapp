import axios from 'axios';
export default function tiktok(sock) {

sock.ev.on('messages.upsert', ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg || msg.isHistory) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    
    if (text.startsWith('!tt')) {
      sock.sendMessage(msg.key.remoteJid, {text: 'Proses!! mohon tunggu...'},{quoted: msg});
        const url = text.split(' ')[1];

        if (!url || !url.includes('tiktok.com')) {
            return sock.sendMessage(msg.key.remoteJid, { text: '❌ Kirim format: !tt <link-video>' }, { quoted: msg });
        }

        axios.get(`https://tikwm.com/api/`, {params: {url}})
            .then(({data: {data}}) => {
                    sock.sendMessage(msg.key.remoteJid, { 
                        video: { url: data.play }, 
                        caption: data.title
                    }, { quoted: msg }).then(() => {
                      sock.sendMessage(msg.key.remoteJid, {
                        audio: {url: data.music}, mimetype: 'audio/mpeg'
                      },{
                        quoted: msg
                      });
                    }).catch(err => console.log(err));
            }).catch((err) => {
              sock.sendMessage(msg.key.remoteJid, { text: '❌ Terjadi kesalahan koneksi server.' }, { quoted: msg });
              console.log(err);
            });
    }
});

}