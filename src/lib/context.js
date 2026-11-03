import config from "#config/global.js";
import db from "#database";
import { isPremium } from "./economy.js";
import { jidUser } from "./utils.js";

const ownerNumbers = new Set(config.owner.number);

const matchesParticipant = (participant, parts) =>
    [participant.id, participant.lid, participant.phoneNumber, participant.jid].some(
        id => id && parts.has(jidUser(id))
    );

function parseCommand(text) {
    const safeText = String(text || ""); // Lindungi jika text bernilai undefined/null
    const prefix = config.prefix.find(item => safeText.startsWith(item));
    if (!prefix) return { prefix: "", command: "", text: "", args: [] };
    const match = safeText.slice(prefix.length).trimStart().match(/^(\S+)([\s\S]*)$/);
    if (!match) return { prefix, command: "", text: "", args: [] };
    const rest = match[2].trim();
    return {
        prefix,
        command: match[1].toLowerCase(),
        text: rest,
        args: rest ? rest.split(/\s+/) : []
    };
}

export default async function buildContext(sock, m) {
    const user = db.users.get(m.userId);
    user.lastSeen = Date.now();
    if (m.name && user.name !== m.name && !user.registered) user.name = m.name;
    sock.names.set(m.number, m.name);

    const senderParts = new Set([m.userId, m.sender].filter(Boolean).map(jidUser));
    const isOwner = [...senderParts].some(part => ownerNumbers.has(part));

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
        const bot = participants.find(item => matchesParticipant(item, botParts));
        isSuperAdmin = self?.admin === "superadmin";
        isAdmin = isSuperAdmin || self?.admin === "admin";
        isBotAdmin = Boolean(bot?.admin);
        if (metadata?.subject) group.name = metadata.subject;
    }

    return {
        sock,
        conn: sock,
        m,
        db,
        database: db,
        user,
        group,
        metadata,
        groupMetadata: metadata,
        participants,
        isOwner,
        isSelf: m.fromMe,
        isAdmin,
        isSuperAdmin,
        isBotAdmin,
        isPremium: isPremium(user),
        ...parseCommand(m.text)
    };
}
