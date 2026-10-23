import {
    getContentType,
    normalizeMessageContent,
    jidNormalizedUser
} from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

global.commands = new Map();
global.prefixes = [".", "!", "/"];
global.owner = ["601143030730", "6285111509070"]; 
const cmdsFolder = path.join(import.meta.dirname, "../scripts");

const groupMetadataCache = new Map();

const readCmds = async (dir = cmdsFolder) => {
    if (dir === cmdsFolder) global.commands.clear();
    if (!fs.existsSync(dir)) {
        console.error(`Command folder does not exist: ${dir}`);
        return;
    }
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            await readCmds(fullPath);
            continue;
        }
        if (path.extname(file) !== ".js") continue;
        try {
            const fileUrl = pathToFileURL(fullPath);
            fileUrl.searchParams.set("v", Date.now());
            const module = await import(fileUrl.href);
            const command = module.default;
            if (!command || !Array.isArray(command.commands)) {
                console.warn(`Invalid command format: ${file}`);
                continue;
            }
            for (const alias of command.commands) {
                if (typeof alias !== "string") continue;
                global.commands.set(alias.toLowerCase(), command);
            }
            console.log(`Loaded command: ${command.commands.join(", ")}`);
        } catch (error) {
            console.error(`Error loading command ${file}:`, error);
        }
    }
};
await readCmds();

fs.watch(cmdsFolder, { recursive: true }, async (eventType, filename) => {
    if (!filename?.endsWith(".js")) return;
    console.log(`[COMMAND] ${eventType}: ${filename}`);
    try {
        await readCmds();
        console.log("[COMMAND] Commands reloaded.");
    } catch (error) {
        console.error("[COMMAND] Failed to reload:", error);
    }
});

async function getCachedGroupMetadata(sock, chatId) {
    if (groupMetadataCache.has(chatId)) {
        return groupMetadataCache.get(chatId);
    }
    try {
        const metadata = await sock.groupMetadata(chatId);
        groupMetadataCache.set(chatId, metadata);
        setTimeout(() => groupMetadataCache.delete(chatId), 10 * 60 * 1000);
        return metadata;
    } catch (e) {
        return {};
    }
}

export default async function (sock, msg) {
    const content = normalizeMessageContent(msg.message);
    if (!content) return;

    msg.id = msg.key.id;
    msg.fromMe = msg.key.fromMe;
    msg.chat = jidNormalizedUser(msg.key.remoteJid || msg.key.remoteJidAlt || "");
    msg.isGroup = msg.chat.endsWith("@g.us");
    msg.username = msg.key.participantUsername || msg.key.remoteJidUsername
    msg.sender = jidNormalizedUser(
        msg.isGroup 
            ? (msg.key.participant || msg.key.participantAlt || msg.participant) 
            : msg.chat
    );
    msg.name = msg.pushName || msg.verifiedBizName || "Unknown";

    const mtype = getContentType(content);
    if (!mtype) return;
    const m = content[mtype];
    
    let rawText = "";
    if (typeof m === "string") rawText = m;
    else if (m?.text) rawText = m.text;
    else if (m?.caption) rawText = m.caption;

    msg.type = mtype;
    msg.msg = m;
    msg.text = rawText || "";

    const contextInfo = m?.contextInfo || {};
    msg.mentionedJid = contextInfo.mentionedJid || [];
    const quotedMessage = contextInfo.quotedMessage;
    
    if (quotedMessage) {
        const normalizedQuoted = normalizeMessageContent(quotedMessage);
        if (normalizedQuoted) {
            const quotedType = getContentType(normalizedQuoted);
            const quotedMsg = normalizedQuoted[quotedType];
            msg.quoted = {
                type: quotedType,
                msg: quotedMsg,
                id: contextInfo.stanzaId || null,
                sender: jidNormalizedUser(contextInfo.participant || contextInfo.participantAlt || ""),
                text: typeof quotedMsg === "string" ? quotedMsg : quotedMsg?.text || quotedMsg?.caption || ""
            };
        } else {
            msg.quoted = null;
        }
    } else {
        msg.quoted = null;
    }

    msg.reply = (text, options) =>
        sock.sendMessage(msg.chat, { text, ...options }, { quoted: msg });

    const senderNumber = msg.sender.split("@")[0];
    const isOwner = global.owner.includes(senderNumber);

    const groupMetadata = msg.isGroup ? await getCachedGroupMetadata(sock, msg.chat) : {};
    const participants = msg.isGroup ? (groupMetadata.participants || []) : [];
    
    const user = m.isGroup
            ? participants?.find( u => (u.id || u.phoneNumber) === m.sender ||
            u.username === msg.username
              ) || {}
            : {};
        const bot = m.isGroup
            ? participants?.find(
                  u =>
                      (u.id || u.phoneNumber) === sock.user?.lid ||
                      (u.id || u.phoneNumber) === sock.user?.id
              ) || {}
            : {};
        
    const isRAdmin = user?.admin === "superadmin";
    const isAdmin = isRAdmin || user?.admin === "admin";
    const isBotAdmin = !!bot?.admin;

    const prefix = global.prefixes.find(p => msg.text.startsWith(p));
    if (!prefix) return; 

    const args = msg.text.slice(prefix.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();
    const text = args.join(" ");

    const cmd = global.commands.get(command);
    if (cmd) {
        console.log(`[CMD] ${msg.name} (${senderNumber}) mengetik: ${prefix + command}`);

        if (cmd.group && !msg.isGroup)
            return m.reply("Perintah ini hanya untuk group sahaja");
        if (cmd.admin && !isAdmin)
            return m.reply("Perintah ini hanya untuk admin sahaja");
        if (cmd.botadmin && !isBotAdmin)
            return m.reply("Jadikan bot jadi admin terlebih dahulu");
        if (cmd.owner && !isOwner)
            return m.reply("Fitur ini hanya untuk owner sahaja");

        try {
            await cmd.exec(msg, {
                sock,
                prefix,
                command,
                args,
                text,
                groupMetadata,
                participants,
                user,
                bot,
                isOwner,
                isAdmin,
                isBotAdmin
            });
        } catch (e) {
            console.error(`Error executing command ${command}:`, e);
            m.reply("Berlaku ralat semasa menjalankan command..");
        }
    }
}
