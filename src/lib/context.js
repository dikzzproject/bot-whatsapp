import { getBotConfig } from "./botconfig.js";
import { matchPlugin } from "./plugins.js";

const ownerNumbers = new Set(config.owner.number);

const matchesParticipant = (participant, parts) =>
    [participant.id, participant.lid, participant.phoneNumber, participant.jid].some(
        id => id && parts.has(jidUser(id))
    );

function migrateUser(m) {
    if (!m.lid || !m.pn) return;
    const table = db.users.table;
    if (table[m.pn] && !table[m.lid]) {
        table[m.lid] = table[m.pn];
        delete table[m.pn];
    }
}

export default async function buildContext(sock, m) {
    migrateUser(m);
    const user = db.users.get(m.userId);
    user.lastSeen = Date.now();
    if (m.name && user.name !== m.name && !user.registered) user.name = m.name;
    sock.names.set(m.number, m.name);

    const bot = getBotConfig(sock);
    const senderParts = new Set([m.userId, m.sender, m.pn, m.lid].filter(Boolean).map(jidUser));
    const isOwner = [...senderParts].some(part => ownerNumbers.has(part));
    const isBotOwner = isOwner || m.fromMe || [...senderParts].some(part => bot.owners.includes(part));

    let group = null;
    let metadata = null;
    let participants = [];
    let isAdmin = false;
    let isSuperAdmin = false;
    let isBotAdmin = false;

    if (m.isGroup) {
        group = db.groups.get(m.chat);
        metadata = await sock.getGroupMetadata(m.chat);
        participants = metadata?.participants ?? [];
        const self = participants.find(item => matchesParticipant(item, senderParts));
        const botParts = new Set([sock.botJid, sock.botLid].filter(Boolean).map(jidUser));
        const botMember = participants.find(item => matchesParticipant(item, botParts));
        isSuperAdmin = self?.admin === "superadmin";
        isAdmin = isSuperAdmin || self?.admin === "admin";
        isBotAdmin = Boolean(botMember?.admin);
        if (metadata?.subject) group.name = metadata.subject;
    }

    const matched = matchPlugin(m.text, bot.prefix);

    const ctx = {
        sock,
        conn: sock,
        m,
        db,
        database: db,
        user,
        users: user,
        group,
        metadata,
        groupMetadata: metadata,
        participants,
        bot,
        messages: bot.messages,
        prefixes: bot.prefix,
        isOwner,
        isDeveloper: isOwner,
        isBotOwner,
        isSelf: m.fromMe,
        isAdmin,
        isSuperAdmin,
        isBotAdmin,
        isPremium: isPremium(user),
        isPrems: isPremium(user),
        plugin: matched?.plugin ?? null,
        match: matched?.match ?? null,
        prefix: matched?.prefix ?? "",
        usedPrefix: matched?.prefix ?? "",
        customPrefix: matched?.prefix ?? "",
        command: matched?.command ?? "",
        text: matched?.text ?? "",
        args: matched?.args ?? []
    };
    ctx.vars = templateVars(ctx);
    return ctx;
}
