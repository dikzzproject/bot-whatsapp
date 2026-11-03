import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { fileTypeFromBuffer } from "file-type";
import {
    downloadContentFromMessage,
    getContentType,
    jidDecode,
    jidNormalizedUser,
    normalizeMessageContent
} from "@whiskeysockets/baileys";
import log from "#logger";
import { jidUser, sleep } from "#lib/utils.js";

const MAX_SENT_IDS = 500;

const canQuote = quoted => {
    try {
        const content = normalizeMessageContent(quoted?.message);
        return Boolean(quoted?.key && content && getContentType(content));
    } catch {
        return false;
    }
};

const withoutQuote = options => {
    const { quoted, ...rest } = options ?? {};
    return rest;
};

export default function extendSocket(
    sock,
    { role, number, groupCache, msgStore, sessionPath }
) {
    sock.role = role;
    sock.isJadibot = role === "jadibot";
    sock.sessionNumber = number;
    sock.sessionPath = sessionPath;
    sock.groupCache = groupCache;
    sock.msgStore = msgStore;
    sock.sentIds = new Set();
    sock.names = new Map();

    Object.defineProperties(sock, {
        botJid: {
            get: () => (sock.user?.id ? jidNormalizedUser(sock.user.id) : "")
        },
        botLid: {
            get: () => (sock.user?.lid ? jidNormalizedUser(sock.user.lid) : "")
        },
        botNumber: {
            get: () => jidUser(sock.user?.id)
        }
    });

    const originalSend = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content, options = {}, ...rest) => {
        let finalOptions = options ?? {};

        if (finalOptions.quoted && !canQuote(finalOptions.quoted)) {
            log.warn("quote", "Mesej tidak boleh dipetik, dihantar tanpa balasan.", Object.keys(finalOptions.quoted ?? {}));
            finalOptions = withoutQuote(finalOptions);
        }

        let sent;
        try {
            sent = await originalSend(jid, content, finalOptions, ...rest);
        } catch (error) {
            if (!finalOptions.quoted || !(error instanceof TypeError)) throw error;
            log.warn("quote", "Baileys gagal memproses petikan, cuba semula tanpa petikan.", error.message);
            sent = await originalSend(jid, content, withoutQuote(finalOptions), ...rest);
        }

        const id = sent?.key?.id;
        if (id) {
            sock.sentIds.add(id);
            if (sock.sentIds.size > MAX_SENT_IDS)
                sock.sentIds.delete(sock.sentIds.values().next().value);
        }
        return sent;
    };

    sock.decodeJid = jid => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decoded = jidDecode(jid) || {};
            return decoded.user && decoded.server
                ? `${decoded.user}@${decoded.server}`
                : jid;
        }
        return jid;
    };

    sock.delay = sleep;

    sock.parseMention = (text = "") =>
        [
            ...String(text).matchAll(
                /@([0-9]{5,16})(?:@(lid|s\.whatsapp\.net))?/g
            )
        ].map(v => `${v[1]}@${v[2] === "lid" ? "lid" : "s.whatsapp.net"}`);

    sock.getGroupMetadata = async jid => {
        const cached = sock.groupCache.get(jid);
        if (cached) return cached;
        try {
            const metadata = await sock.groupMetadata(jid);
            sock.groupCache.set(jid, metadata);
            return metadata;
        } catch {
            return null;
        }
    };

    sock.forgetGroup = jid => sock.groupCache.del(jid);

    sock.getName = async jid => {
        if (!jid) return "";
        if (jid.endsWith("@g.us"))
            return (await sock.getGroupMetadata(jid))?.subject ?? jidUser(jid);
        return sock.names.get(jidUser(jid)) ?? jidUser(jid);
    };

    sock.getFile = async source => {
        let buffer;
        if (Buffer.isBuffer(source)) buffer = source;
        else if (source instanceof Uint8Array) buffer = Buffer.from(source);
        else if (/^data:.*?\/.*?;base64,/i.test(source))
            buffer = Buffer.from(source.split(",")[1], "base64");
        else if (/^https?:\/\//i.test(source)) {
            const response = await axios.get(source, {
                responseType: "arraybuffer",
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024
            });
            buffer = Buffer.from(response.data);
        } else if (typeof source === "string" && fs.existsSync(source))
            buffer = fs.readFileSync(source);
        else throw new Error("Invalid file source.");

        const type = (await fileTypeFromBuffer(buffer)) ?? {
            mime: "application/octet-stream",
            ext: "bin"
        };
        return { buffer, mime: type.mime, ext: type.ext };
    };

    sock.sendFile = async (
        jid,
        source,
        {
            filename = "",
            caption = "",
            quoted,
            ptt = false,
            asDocument = false,
            ...extra
        } = {}
    ) => {
        const { buffer, mime, ext } = await sock.getFile(source);
        const options = quoted ? { quoted } : {};
        let content;

        if (asDocument)
            content = {
                document: buffer,
                mimetype: mime,
                fileName: filename || `file.${ext}`,
                caption
            };
        else if (mime === "image/webp" && extra.sticker)
            content = { sticker: buffer };
        else if (mime.startsWith("image/"))
            content = { image: buffer, caption };
        else if (mime.startsWith("video/"))
            content = { video: buffer, caption };
        else if (mime.startsWith("audio/"))
            content = {
                audio: buffer,
                mimetype: ptt ? "audio/ogg; codecs=opus" : mime,
                ptt
            };
        else
            content = {
                document: buffer,
                mimetype: mime,
                fileName: filename || `file.${ext}`,
                caption
            };

        delete extra.sticker;
        return sock.sendMessage(jid, { ...content, ...extra }, options);
    };

    sock.reply = (jid, text, quoted, extra = {}) =>
        sock.sendMessage(
            jid,
            {
                text: String(text),
                mentions: [
                    ...new Set([
                        ...sock.parseMention(text),
                        ...(extra.mentions ?? [])
                    ])
                ],
                ...extra
            },
            quoted ? { quoted } : {}
        );

    sock.downloadM = async (m, type, saveToFile = false) => {
        if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
        const stream = await downloadContentFromMessage(m, type);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        
        if (saveToFile) {
            const tempDir = path.join(process.cwd(), "temp");
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            
            const typeInfo = await fileTypeFromBuffer(buffer) || { ext: "bin" };
            const filename = path.join(tempDir, `${Date.now()}.${typeInfo.ext}`);
            fs.writeFileSync(filename, buffer);
            return filename;
        }
        return buffer;
    };

    sock.downloadMediaMessage2 = async message => {
        const m = message?.msg || message?.message || message;
        const mtype = Object.keys(m)[0];
        const stream = await downloadContentFromMessage(
            m[mtype],
            mtype.replace(/Message$/, "").toLowerCase()
        );
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return Buffer.concat(chunks);
    };

    return sock;
}
