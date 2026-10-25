import fs from 'fs';
import {pathToFileURL} from 'url';

const plugins = new Map();

export function loadPlugins() {
  fs.readdirSync('plugins').forEach(file => {
    if (!file.endsWith('.js'));

    import(pathToFileURL(`plugins/${file}`)).then(module => {
      if (module.default?.name) plugins.set(module.default?.name, module.default);
    }).catch(e => console.log(e));
  });
}

export function handle(sock, messages) {
  const msg = messages[0];
  if (!msg || !msg.message) return;

  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  if (!text || !text.startsWith('!')) return;

  msg.reply = (txt) => sock.sendMessage(msg.key.remoteJid, {text: txt},{quoted: msg});
  msg.video = (media, desk) => sock.sendMessage(msg.key.remoteJid, {video: {url: media}, caption: desk},{quoted: msg});
  msg.chat = (txt) => sock.sendMessage(msg.key.remoteJid, {text: txt},{quoted: msg});

  const [cmd, ...args] = text.slice(1).trim().split(/\s+/);

  Promise.resolve().then(() => {
    plugins.get(cmd.toLowerCase())?.run(sock,msg,args);
  }).catch(e => console.log(e));
}