const cache = new Map();

export default function welcome(sock) {
  const pp_def = './assets/default.jpg';
  
  sock.ev.on('group-participants.update', (update) => {
    const {id, participants, action} = update;

    if (action === 'add') {
      const cacheGrub = cache.get(id);

      if (cacheGrub) {
        msg(sock, id, participants, cacheGrub.name, cacheGrub.desc, pp_def);
      } else {
        sock.groupMetadata(id).then(metadata => {
          const name = metadata.subject;
          const desc = metadata.desc ? metadata.desc.toString() : 'No description Groub!';
          cache.set(id, {name, desc});
          msg(sock, id, participants, name, desc, pp_def);
        }).catch(err => console.log(err));
      }
    }
  });
}

function msg(sock, id, participants, name, desc, pp_def) {
  const grub = [
    `120363363094898848@g.us`,
    `120363411361642606@g.us`,
    `120363412437638468@g.us`
  ];
  const intro = 
  `*"welcome in kamar anime."*

          *'card intro'*
•----------------------------------•
➜ nama :
➜ umur :
➜ status :
➜ waifu :
➜ husbu :
➜ askot :
➜ gender :
•----------------------------------•
#mogabetah.
#janlupsharelink.`;
  for (const participant of participants) {
    const userJid = typeof participant === 'string' ? participant : (participant.id || String(participant));
    const member = `@${userJid.split('@')[0]}`;
    const msgText = `Hello, ${member}. \n\n${desc}`;
    if (grub.includes(id)) {
    sock.sendMessage(id, {
         text: msgText,
          mentions: [userJid]
    }).then(() => sock.sendMessage(id, {text: `${intro}\n${member}`, mentions: [userJid]}));
    }
  }
}