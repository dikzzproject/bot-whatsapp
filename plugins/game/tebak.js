import pustakaKata from "#database/assets/pustaka_kata.js";
import pustakaBendera from "#database/assets/pustaka_bendera.js";
import { reward } from "#lib/economy.js";
import SessionStore from "#lib/gameSession.js";
import { pickRandom, randomInt } from "#lib/utils.js";

const sessions = new SessionStore({ ttl: 90000 });
const SURRENDER = /^(menyerah|nyerah|surrender)$/i;
const normalize = text => String(text).toLowerCase().trim();

const GAMES = {
    tebakkata: {
        label: "Teka Kata",
        create: () => {
            const { kata, clue } = pickRandom(pustakaKata);
            const hint = kata[0] + " _".repeat(kata.length - 1);
            return { answers: [kata], question: `Petunjuk: ${clue}\nKata: ${hint} (${kata.length} huruf)` };
        }
    },
    susunkata: {
        label: "Susun Kata",
        create: () => {
            const { kata, clue } = pickRandom(pustakaKata);
            let scrambled = kata;
            while (scrambled === kata && kata.length > 1) scrambled = [...kata].sort(() => Math.random() - 0.5).join("");
            return { answers: [kata], question: `Susun huruf ini: *${scrambled.toUpperCase()}*\nPetunjuk: ${clue}` };
        }
    },
    tebakbendera: {
        label: "Teka Bendera",
        create: () => {
            const item = pickRandom(pustakaBendera);
            return { answers: [item.name, ...item.alias].map(normalize), question: `Negara manakah bendera ini?\n\n${item.flag}`, display: item.name };
        }
    }
};

const start = name => async (m, { sock, prefix }) => {
    const game = GAMES[name];
    const existing = sessions.get(m.chat);
    if (existing) return m.reply(`🎮 Permainan masih berjalan:\n${existing.question}`);

    const data = game.create();
    const text = `🎮 *${game.label}*\n${data.question}\n\n_Balas mesej ini atau taip jawapan terus._\n_Taip *menyerah* untuk berhenti. Masa: 90 saat._`;
    const sent = await m.reply(text);
    sessions.start(m.chat, { ...data, game: name, messageId: sent.key.id }, {
        onExpire: s => sock.sendMessage(m.chat, { text: `⌛ Masa tamat! Jawapan: *${s.display ?? s.answers[0]}*` })
    });
};

export default [
    ...Object.keys(GAMES).map(name => ({
        command: [name],
        help: [name],
        tags: ["game"],
        exec: start(name)
    })),
    {
        before: async (m, ctx) => {
            const session = sessions.get(m.chat);
            if (!session || m.fromMe || !m.text || ctx.command) return false;

            const answer = normalize(m.text);
            if (SURRENDER.test(answer)) {
                sessions.end(m.chat);
                await m.reply(`🏳️ Menyerah! Jawapan: *${session.display ?? session.answers[0]}*`);
                return true;
            }

            if (session.answers.includes(answer)) {
                sessions.end(m.chat);
                const prize = randomInt(150, 400);
                reward(ctx.user, { money: prize, exp: 30 });
                await m.reply(`✅ Betul! +${prize} wang, +30 exp.`);
                return true;
            }

            if (m.quoted?.id === session.messageId) {
                await m.reply("❌ Salah, cuba lagi.");
                return true;
            }
            return false;
        }
    }
];
