import makeWaSocket, {DisconnectReason,useMultiFileAuthState} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import ping, {menu} from './scripts/pesan.js';
import readSw, {buatSticker,tagall} from './scripts/fitur.js';
import tebakkata from './minigame/tebakkata.js'
import kick from './scripts/kick.js';
import gcSetting from './scripts/open-close.js';
import tomp3 from './scripts/tomp3.js';
import tiktok from './scripts/tt.js';
import welcome from './scripts/welcome.js';

function bot(nomer) {
  const session = `session/${nomer}`;
  useMultiFileAuthState(session).then(({state, saveCreds}) => {
    const sock = (makeWaSocket.default || makeWaSocket)({
      auth: state,
      printQRInTerminal: false,
      logger: pino({level: 'silent'})
    });

    sock.ev.on('connection.update', ({connection, lastDisconnect}) => {
      if (connection === 'close') {
        if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
          bot(nomer);
        } else {
          if (fs.existsSync(session)) {
            fs.rmSync(session, {recursive: true, force: true});
          }
        }
      }

      if (connection === 'open') {
        console.log(`session-+${nomer} is active now!`);
      }
    });

    if (!sock.authState.creds.registered) {
      setTimeout(() => {
        sock.requestPairingCode(nomer).then(kode => {
          console.log(`Pairing Code: ${kode.match(/.{1,4}/g, '').join('–')}`);
        }).catch(err => console.log(err));
      },3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', ({messages, type}) => {
      const msg = messages[0];
      const chatId = msg.key.remoteJid;

      ping(sock, chatId, msg);
    });
  }).catch(err => console.log(err));
}

bot(6285111509070);