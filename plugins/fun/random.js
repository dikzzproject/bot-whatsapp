const { DARE, KHODAM, MAGIC_SHELL, SIFAT, TRUTH, WHEN_UNITS, WHERE, YES_NO } = assets.fun;

const question = ({ command, label, answer }) => ({
    command: [command],
    help: [`${command} <soalan>`],
    tags: ["fun"],
    needText: true,
    exec: (m, { text }) => m.reply(`❓ *${label}* ${text}\n💬 ${answer()}`)
});

const questions = [
    { command: "apakah", label: "Apakah", answer: () => pickRandom(YES_NO) },
    { command: "benarkah", label: "Benarkah", answer: () => pickRandom(YES_NO) },
    { command: "bisakah", label: "Bolehkah", answer: () => pickRandom(YES_NO) },
    { command: "dimanakah", label: "Di manakah", answer: () => pickRandom(WHERE) },
    { command: "kapan", label: "Bila", answer: () => `Dalam ${randomInt(1, 30)} ${pickRandom(WHEN_UNITS)} lagi` },
    { command: "kerangajaib", label: "Kerang ajaib,", answer: () => pickRandom(MAGIC_SHELL) },
    { command: "seberapagila", label: "Seberapa gila", answer: () => `${randomInt(0, 100)}%` }
].map(question);

const randomMember = (participants, count = 1) =>
    [...participants].sort(() => Math.random() - 0.5).slice(0, count).map(p => p.id);

const mention = jid => `@${jid.split("@")[0]}`;

export default [
    ...questions,
    {
        command: ["rate"],
        help: ["rate <teks>"],
        tags: ["fun"],
        needText: true,
        exec: (m, { text }) => m.reply(`⭐ Nilai untuk *${text}*: ${randomInt(0, 100)}/100`)
    },
    {
        command: ["ceksifat", "sifat"],
        help: ["ceksifat [@tag]"],
        tags: ["fun"],
        exec: (m) => {
            const target = m.target || m.sender;
            const traits = [...SIFAT].sort(() => Math.random() - 0.5).slice(0, 3).join(", ");
            return m.reply(`🧬 Sifat ${mention(target)}: ${traits}`, { mentions: [target] });
        }
    },
    {
        command: ["cekkhodam", "khodam"],
        help: ["cekkhodam [@tag]"],
        tags: ["fun"],
        exec: m => {
            const target = m.target || m.sender;
            return m.reply(`👻 Khodam ${mention(target)}: *${pickRandom(KHODAM)}*`, { mentions: [target] });
        }
    },
    {
        command: ["truth", "jujur"],
        help: ["truth"],
        tags: ["fun"],
        exec: m => m.reply(`🟦 *TRUTH*\n${pickRandom(TRUTH)}`)
    },
    {
        command: ["dare", "cabaran"],
        help: ["dare"],
        tags: ["fun"],
        exec: m => m.reply(`🟥 *DARE*\n${pickRandom(DARE)}`)
    },
    {
        command: ["truthordare", "tod"],
        help: ["tod"],
        tags: ["fun"],
        exec: m => {
            const isTruth = Math.random() < 0.5;
            return m.reply(isTruth ? `🟦 *TRUTH*\n${pickRandom(TRUTH)}` : `🟥 *DARE*\n${pickRandom(DARE)}`);
        }
    },
    {
        command: ["sipaling"],
        help: ["sipaling <teks>"],
        tags: ["fun"],
        group: true,
        needText: true,
        exec: (m, { participants, text }) => {
            const [jid] = randomMember(participants);
            return m.reply(`🏅 Paling *${text}* ialah ${mention(jid)}`, { mentions: [jid] });
        }
    },
    {
        command: ["top"],
        help: ["top <teks>"],
        tags: ["fun"],
        group: true,
        needText: true,
        exec: (m, { participants, text }) => {
            const members = randomMember(participants, 5);
            const list = members.map((jid, i) => `${i + 1}. ${mention(jid)}`).join("\n");
            return m.reply(`🏆 *Top ${members.length} ${text}*\n\n${list}`, { mentions: members });
        }
    }
];
