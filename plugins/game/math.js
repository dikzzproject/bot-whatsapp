import { reward } from "#lib/economy.js";
import SessionStore from "#lib/gameSession.js";
import { randomInt } from "#lib/utils.js";

const sessions = new SessionStore({ ttl: 30000 });

const MODES = {
    easy: { range: [1, 20], ops: ["+", "-"], prize: 100 },
    normal: { range: [10, 100], ops: ["+", "-", "*"], prize: 250 },
    hard: { range: [50, 500], ops: ["+", "-", "*"], prize: 500 },
    expert: { range: [100, 1000], ops: ["+", "-", "*"], prize: 1000 },
    master: { range: [500, 5000], ops: ["+", "-", "*"], prize: 5000 }
};

const solve = (a, op, b) => (op === "+" ? a + b : op === "-" ? a - b : a * b);

export default [
    {
        command: ["math", "matematik"],
        help: ["math <easy|normal|hard|expert|master>"],
        tags: ["game"],
        exec: async (m, { args, sock }) => {
            const mode = (args[0] ?? "").toLowerCase();
            if (!MODES[mode]) return m.reply(`Pilih mod: ${Object.keys(MODES).join(", ")}`);
            if (sessions.has(m.chat)) return m.reply("Masih ada soalan matematik yang belum dijawab.");

            const { range, ops, prize } = MODES[mode];
            const a = randomInt(...range);
            const b = randomInt(...range);
            const op = ops[randomInt(0, ops.length - 1)];
            const answer = solve(a, op, b);
            const symbol = op === "*" ? "×" : op;

            await m.reply(`🧮 *${a} ${symbol} ${b} = ?*\nMasa: 30 saat • Hadiah: ${prize} wang`);
            sessions.start(m.chat, { answer, prize }, {
                onExpire: s => sock.sendMessage(m.chat, { text: `⌛ Masa tamat! Jawapan: *${s.answer}*` })
            });
        }
    },
    {
        before: async (m, ctx) => {
            const session = sessions.get(m.chat);
            if (!session || m.fromMe || ctx.command || !/^-?\d+$/.test(m.text.trim())) return false;
            if (Number(m.text.trim()) !== session.answer) return false;

            sessions.end(m.chat);
            reward(ctx.user, { money: session.prize, exp: 20 });
            await m.reply(`✅ Betul! +${session.prize} wang, +20 exp.`);
            return true;
        }
    }
];
