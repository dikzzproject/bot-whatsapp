const EXPIRE_MS = 5 * 60 * 1000;
const tag = jid => `@${jid.split("@")[0]}`;

export default [
    {
        command: ["tembak", "propose"],
        help: ["tembak <@tag>"],
        tags: ["fun"],
        group: true,
        exec: (m, { user, db }) => {
            if (!m.target) return m.reply("Tag orang yang mahu anda tembak.");
            if (m.target === m.userId) return m.reply("Tidak boleh menembak diri sendiri.");
            if (user.partner) return m.reply("Anda sudah mempunyai pasangan. Taip .putus dahulu.");

            const target = db.users.get(m.target);
            if (target.partner) return m.reply("Dia sudah mempunyai pasangan.");

            target.proposal = { from: m.userId, at: Date.now() };
            return m.reply(`💘 ${tag(m.userId)} menembak ${tag(m.target)}!\nTaip *.terima* atau *.tolak* dalam masa 5 minit.`, {
                mentions: [m.userId, m.target]
            });
        }
    },
    {
        command: ["terima", "accept"],
        help: ["terima"],
        tags: ["fun"],
        group: true,
        exec: (m, { user, db }) => {
            const { from, at } = user.proposal;
            if (!from || Date.now() - at > EXPIRE_MS) return m.reply("Tiada tembakan yang menunggu anda.");
            const lover = db.users.get(from);
            user.partner = from;
            lover.partner = m.userId;
            user.proposal = { from: "", at: 0 };
            return m.reply(`💞 Tahniah! ${tag(from)} dan ${tag(m.userId)} kini berpasangan.`, { mentions: [from, m.userId] });
        }
    },
    {
        command: ["tolak", "reject"],
        help: ["tolak"],
        tags: ["fun"],
        group: true,
        exec: (m, { user }) => {
            const { from, at } = user.proposal;
            if (!from || Date.now() - at > EXPIRE_MS) return m.reply("Tiada tembakan yang menunggu anda.");
            user.proposal = { from: "", at: 0 };
            return m.reply(`💔 ${tag(m.userId)} menolak ${tag(from)}.`, { mentions: [from, m.userId] });
        }
    },
    {
        command: ["putus", "break"],
        help: ["putus"],
        tags: ["fun"],
        exec: (m, { user, db }) => {
            if (!user.partner) return m.reply("Anda tiada pasangan.");
            const former = user.partner;
            const record = db.users.find(former);
            if (record && record.partner === m.userId) record.partner = "";
            user.partner = "";
            return m.reply(`💔 Anda putus dengan ${tag(former)}.`, { mentions: [former] });
        }
    },
    {
        command: ["pacar", "pasangan"],
        help: ["pacar"],
        tags: ["fun"],
        exec: (m, { user }) =>
            m.reply(user.partner ? `💞 Pasangan anda: ${tag(user.partner)}` : "💔 Anda belum mempunyai pasangan.", {
                mentions: user.partner ? [user.partner] : []
            })
    }
];
