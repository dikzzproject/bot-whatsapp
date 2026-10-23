import {
    getContentType,
    normalizeMessageContent
} from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

global.commands = new Map();
global.prefixes = [".", "!", "/"];
global.owner = ["601143030730", "6285111509070"];
const cmdsFolder = path.join(import.meta.dirname, "../scripts");

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

export default async function (sock, msg) {
    const content = normalizeMessageContent(msg.message);
    if (!content) return;

    msg.id = msg.key.id;
    msg.fromMe = msg.key.fromMe;
    msg.chat = msg.key.remoteJid || msg.key.remoteJidAlt || "";
    msg.isGroup = msg.chat.endsWith("@g.us");
    msg.username = msg.isGroup
        ? msg.key.participantUsername
        : msg.key.remoteJidUsername || "";
    msg.sender = msg.isGroup
        ? msg.key.participant || msg.key.participantAlt
        : msg.chat || "";
    msg.userName = msg.pushName || msg.verifiedBizName || "Unkown";

    const mtype = getContentType(content);
    if (!mtype) return;
    const m = content[mtype];

    let text = "";
    if (typeof m === "string") text = m;
    else if (m?.text) text = m.text;
    else if (m?.caption) text = m.caption;
    else if (mtype === "conversation" && typeof m === "string") text = m;

    msg.type = mtype;
    msg.msg = m;
    msg.text = text || "";
    m.args = m.text
        ?.trim()
        .split(" ")
        .slice(1)
        .filter(v => v);

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
                sender:
                    contextInfo.participant || contextInfo.participantAlt || "",
                text:
                    typeof quotedMsg === "string"
                        ? quotedMsg
                        : quotedMsg?.text || quotedMsg?.caption || ""
            };
        } else {
            msg.quoted = null;
        }
    } else {
        msg.quoted = null;
    }

    msg.reply = (text, options) =>
        sock.sendMessage(msg.chat, { text, ...options }, { quoted: msg });

    const isOwner =
        msg.sender === `${global.number[0]}@s.whatsapp.net` ||
        msg.sender === `${global.number}@lid`
            ? true
            : false;

    const groupMetadata = m.isGroup ? await conn.groupMetadata(m.chat) : {};
    const participants = m.isGroup ? groupMetadata.participants : [];
    const user = m.isGroup
        ? participants.find(
              p => p.phoneNumber === m.sender || p.id === m.sender
          )
        : {};
    const bot = m.isGroup
        ? participants.find(p => p.phoneNumber === conn.user.id)
        : {};
    const isRAdmin = user?.admin === "superadmin" ? true : false;
    const isAdmin = isRAdmin || user?.admin === "admin" ? true : false;
    const isBotAdmin = !!bot?.admin;

    const regex = new RegExp(`^([${global.prefixes.join("")}])\\s+`);
    const normalized = m.text.trim().replace(regex, "$1");
    const prefix = global.prefixes.find(p => normalized.startsWith(p));

    const command = prefix
        ? normalized.slice(prefix.length).trim().split(" ")[0].toLowerCase()
        : "";

    const args = normalized
        .slice(prefix ? prefix.length : 0)
        .trim()
        .split(/\s+/)
        .slice(1);
    const text = args.join(" ");

    const cmd = global.commands.get(command);
    if (cmd) {
        console.log(`${m.userName} taip: ${prefix + command}`);

        if (cmd.group && !msg.isGroup)
            return m.reply("Perintah ini hanya untuk group sahaja");
        if (cmd.admin && !isAdmin)
            return m.reply("Perintah ini hanya untuk admin sahaja");
        if (cmd.botadmin && !isBotAdmin)
            return m.reply("Jadikan bot jadi admin terlebih dahulu");
        if (cmd.owner && !isOwner)
            return m.reply("Fitur ini hanya untuk owner sahaja");

        try {
            await cmd.execute(msg, {
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
            console.error(e);
            m.reply("berlaku ralat semasa command..");
        }
    }
}
