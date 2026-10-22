import makeWaSocket, {DisconnectReason,useMultiFileAuthState} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import express from 'express';
import path from 'path';
import ping, {menu} from './scripts/pesan.js';
import readSw, {buatSticker,tagall} from './scripts/fitur.js';
import tebakkata from './minigame/tebakkata.js'
import kick from './scripts/kick.js';
import gcSetting from './scripts/open-close.js';
import tomp3 from './scripts/tomp3.js';
import tiktok from './scripts/tt.js';
import welcome from './scripts/welcome.js';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const sock = {};
const stat = {};
let pairingCode = null;
let folders = null;

app.get('/', (req, res) => {
  res.sendFile(path.join(import.meta.dirname, 'index.html'));
});

function bot(num) {
  if (!num) return;
  const nb = num.replace(/[^0-9]/g, '');
  const fb = `session-${nb}`;
  folders = fb;

  useMultiFileAuthState(fb).then(({state, saveCreds}) => {
    const newSock = (makeWaSocket.default || makeWaSocket)({
      auth: state,
      printQRInTerminal: false,
      logger: pino({level: 'silent'})
    });

    sock[nb] = newSock;
    stat[nb] = false;

    sock[nb].ev.on('connection.update', (update) => {
      const {lastDisconnect, connection} = update;

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reconnect = statusCode !== DisconnectReason.loggedOit;

        if (reconnect) {
          bot(num);
        } else {
          delete sock[nb];
          delete stat[nb];
          if (fs.existsSync(folders)) {
            fs.rmSync(folders, {recursive: true, force: true});
          }
        }

        if (connection === "open") {
          console.log(`bot ${nb} aktif`);
          stat[nb] = true;
          pairingCode = null;
        }
      }
    });

    sock[nb].ev.on('creds.update', saveCreds);

    welcome(sock[nb]);
    tebakkata(sock[nb]);
    kick(sock[nb]);
    gcSetting(sock[nb]);
    tomp3(sock[nb]);
    tiktok(sock[nb]);

    sock[nb].ev.on('messages.upsert', ({messages, type}) => {
      
      const msg = messages[0];
      const pesan = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const from = msg.key.remoteJid;

      if (!msg || !msg.message || msg.isHistory) return;

      ping(sock[nb], from, msg);
      menu(sock[nb], from, msg)
      buatSticker(sock[nb], msg, from, type);

      tagall(sock[nb], from, msg);
      
      readSw(sock[nb], from, msg);
      
    });
  }).catch(err => console.log(err));
}

app.post('/jadibot', (req, res) => {
  const {nomer} = req.body;
  const nb = nomer.replace(/[^0-9]/g, '');

  if (stat[nb]) return res.send(`bot ${nb} sudah aktif`);
  if (!nb || nb.trim() === "") return res.send('harap isi form dengan benar');

  bot(nb);
  
  setTimeout(() => {
    const aktif = sock[nb];
    if (!aktif) res.send('gagal memuat bot..');

    aktif.requestPairingCode(nb).then(kode => {
      pairingCode = kode.match(/.{1,4}/g, '').join('-');
      console.log(`kode pairing: ${pairingCode}`);
      return res.send(`kode pairing: ${pairingCode}`);
    }).catch((err) => {
      console.log(err);
    });
  },3000);
});


app.listen(PORT, () => {
  console.log('server aktif');
if (fs.existsSync('./')) {
  fs.readdirSync('./').forEach(file => {
    if (file.startsWith('session-') && fs.statSync(file).isDirectory()) {
      const lastNum = file.replace('session-', '');
      bot(lastNum);
    }
  });
}
});