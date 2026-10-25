import axios from 'axios';

export default {
  name: 'tt',
  run: (sock, msg) => {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const url = text.split(' ')[1];
    if (!url || !url.includes('https://')) return msg.reply('kirim format *!tt* <link>');
    msg.reply('Proses! Mohon tunggu!');
    
    axios.get('https://tikwm.com/api/', {params: {url}}).then(({data: {data}}) => {
      msg.video(data.play, data.title);
    }).catch((e) => {
      msg.reply('Gagal mendownload media');
      console.log(e);
    });
  }
}