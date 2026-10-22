import pustaka from '../assets/js/pustaka_kata.js';

export default function tebakkata(sock) {
  const sesi = new Map();
  
  sock.ev.on('messages.upsert', (m) => {
    const msg = m.messages[0];
    const from = msg.key.remoteJid;
    const command = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const komen = command.toLowerCase().trim();
    const game = sesi.get(from);
    
    if (!msg.message || !komen || msg.isHistory) return;

    if (komen === "!tebakkata") {
      if (game) return sock.sendMessage(from, {text: `🎮 *GAME SUDAH DIMULAI !*\n*Tebak Kata:* ${game.pertanyaan}`}, {quoted: msg});
      const acak = pustaka[Math.floor(Math.random() * pustaka.length)];
      const kata = acak.kata;
      const clue = acak.clue.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      
      const pertanyaan = kata[0] + ' _ '.repeat(kata.length - 2);

      sock.sendMessage(from, {text: `🎮 *Game dimulai!!* 🎮\n*Clue:* ${clue}\n*Kata:* ${pertanyaan} (${kata.length} huruf)\n\n_Pesan ini wajib di *REPLY* jika ingin menjawab pertanyaan._\n_Ketik *menyerah* jika ingin menyerah dari game._`}, {quoted: msg}).then(idPesan => {
        sesi.set(from, {kata, pertanyaan, id: idPesan.key.id});
      });
      return;
    }

    if (!game) return;

    const reply = msg.message.extendedTextMessage?.contextInfo?.stanzaId;

    if (reply === game.id) {
      if (komen === game.kata) {
        sesi.delete(from);
        return sock.sendMessage(from, {text: 'Jawaban benar!!'}, {quoted: msg});
      } else if (komen === "menyerah") {
        sesi.delete(from);
        return sock.sendMessage(from, {text: `Menyerah!! Jawabannya adalah *${game.kata}*`}, {quoted: msg});
      } else {
        return sock.sendMessage(from, {text: 'Jawaban salah! Coba lagi.'}, {quoted: msg});
      }
    }
  });
}