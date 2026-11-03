import {
    areJidsSameUser,
    downloadMediaMessage,
    getContentType,
    jidNormalizedUser,
    normalizeMessageContent,
    proto
} from "@whiskeysockets/baileys";
import log from "#logger";
import { canonicalId, jidUser } from "#lib/utils.js";

const MEDIA_KINDS = {
    imageMessage: "image",
    videoMessage: "video",
    ptvMessage: "video",
    audioMessage: "audio",
    stickerMessage: "sticker",
    documentMessage: "document"
};

const extractText = (body, mtype) => {
    if (!body) return "";
    if (typeof body === "string") return body;

    let text =
        body.text ||
        body.caption ||
        body.conversation ||
        body.selectedButtonId ||
        body.selectedId ||
        body.selectedDisplayText ||
        body.title ||
        body.singleSelectReply?.selectedRowId ||
        "";

    if (mtype === "templateButtonReplyMessage") text = body.selectedId || text;

    if (mtype === "interactiveResponseMessage") {
        try {
            const params = JSON.parse(body.nativeFlowResponseMessage?.paramsJson || "{}");
            text = params.id || params.selectedId || text;
        } catch {
            text = text || "";
        }
    }

    return text;
};

const toSeconds = value => {
    if (value && typeof value === "object") return value.toNumber?.() ?? Number(value.low);
    return Number(value) || Math.floor(Date.now() / 1000);
};

const safeNormalize = jid => (jid ? jidNormalizedUser(jid) : "");

const isBotJid = (sock, jid) =>
    Boolean(jid) && [sock.botJid, sock.botLid].some(own => own && areJidsSameUser(jid, own));

const cloneMessage = info =>
    proto.WebMessageInfo.fromObject({
        key: info.key,
        message: info.message,
        pushName: info.pushName,
        messageTimestamp: info.messageTimestamp
    });

async function fetchMedia(sock, holder, body, mediaType, saveToFile) {
    if (!body) return null;
    const options = { logger: undefined, reuploadRequest: sock.updateMediaMessage };
    try {
        let buffer = sock.downloadM ? await sock.downloadM(body, mediaType, saveToFile) : null;
        if (!buffer || buffer.length === 0) buffer = await downloadMediaMessage(holder, "buffer", {}, options);
        return buffer;
    } catch (error) {
        log.error("serialize", "Gagal memuat turun media", error);
        return null;
    }
}

export default async function serialize(sock, m) {
    if (!m?.message) return null;

    const content = normalizeMessageContent(m.message);
    const type = content ? getContentType(content) : null;
    if (!type) return null;

    const body = content[type];
    const key = m.key;
    const chat = safeNormalize(key.remoteJid || key.remoteJidAlt);
    const isGroup = chat.endsWith("@g.us");
    const ownJid = sock.decodeJid ? sock.decodeJid(sock.user?.lid || sock.user?.id) : safeNormalize(sock.user?.id);
    const username = key.participantUsername || key.remoteJidUsername || "";

    let fromMe = Boolean(key.fromMe);
    const sender =
        (sock.decodeJid
            ? sock.decodeJid(fromMe ? ownJid : key.participant || key.participantAlt || chat)
            : fromMe
              ? ownJid
              : safeNormalize(isGroup ? key.participant : key.remoteJid)) || chat;

    if (!fromMe) fromMe = isBotJid(sock, sender);

    const senderAlt = fromMe ? "" : safeNormalize(isGroup ? key.participantAlt : key.remoteJidAlt);
    const userId = canonicalId(senderAlt, sender);
    const text = extractText(body, type);
    const mediaType = MEDIA_KINDS[type] ?? null;
    const contextInfo = body?.contextInfo ?? {};
    const name = m.pushName || (sock.getName ? await sock.getName(sender) : "") || username || "Without a name";

    Object.assign(m, {
        id: key.id || "",
        chat,
        isGroup,
        fromMe,
        sender,
        senderAlt,
        userId,
        number: jidUser(userId),
        name,
        timestamp: toSeconds(m.messageTimestamp),
        type,
        mtype: type,
        msg: body,
        mediaMessage: body,
        mimetype: body?.mimetype || "",
        text,
        body: text,
        mentionedJid: (contextInfo.mentionedJid ?? []).map(safeNormalize),
        isMedia: Boolean(mediaType),
        mediaType,
        quoted: null,
        mediaSource: null,
        target: ""
    });

    if (contextInfo.quotedMessage) {
        const quotedContent = normalizeMessageContent(contextInfo.quotedMessage);
        const quotedType = quotedContent ? getContentType(quotedContent) : null;

        if (quotedType) {
            const quotedBody = quotedContent[quotedType];
            const quotedSender =
                (sock.decodeJid
                    ? sock.decodeJid(contextInfo.participant || contextInfo.remoteJid || "")
                    : safeNormalize(contextInfo.participant || contextInfo.remoteJid)) || chat;
            const quotedFromMe = isBotJid(sock, quotedSender);
            const quotedKey = {
                remoteJid: chat,
                id: contextInfo.stanzaId,
                participant: contextInfo.participant,
                fromMe: quotedFromMe
            };
            const quotedMedia = MEDIA_KINDS[quotedType] ?? null;
            const quotedText = extractText(quotedBody, quotedType);

            const quoted = {
                key: quotedKey,
                message: contextInfo.quotedMessage,
                ...(isGroup ? { participant: quotedSender } : {}),
                id: contextInfo.stanzaId,
                chat,
                sender: quotedSender,
                fromMe: quotedFromMe,
                type: quotedType,
                mtype: quotedType,
                msg: quotedBody,
                mediaMessage: quotedBody,
                text: quotedText,
                body: quotedText,
                isMedia: Boolean(quotedMedia),
                mediaType: quotedMedia,
                mimetype: quotedBody?.mimetype || "",
                mentionedJid: (contextInfo.mentionedJid ?? []).map(safeNormalize),
                name: sock.getName ? await sock.getName(quotedSender) : "Without a name"
            };

            quoted.download = (saveToFile = false) => fetchMedia(sock, quoted, quotedBody, quotedMedia, saveToFile);
            quoted.reply = (text, options = {}) => sock.reply(chat, text, quoted, options);
            quoted.react = emoji => sock.sendMessage(chat, { react: { text: emoji, key: quotedKey } });
            quoted.delete = () => sock.sendMessage(chat, { delete: quotedKey });
            quoted.copy = () => serialize(sock, cloneMessage(quoted));
            quoted.forward = (jid = chat, force = false, options = {}) =>
                sock.sendMessage(jid, { forward: quoted, force }, options);

            m.quoted = quoted;
        }
    }

    m.mediaSource = m.isMedia ? m : m.quoted?.isMedia ? m.quoted : null;
    m.target = m.mentionedJid[0] || m.quoted?.sender || "";

    m.reply = (text, options = {}) => sock.reply(chat, text, m, options);
    m.react = emoji => sock.sendMessage(chat, { react: { text: emoji, key } });
    m.send = (message, options = {}) => sock.sendMessage(chat, message, options);
    m.delete = () => sock.sendMessage(chat, { delete: key });
    m.copy = () => serialize(sock, cloneMessage(m));
    m.forward = (jid = chat, force = false, options = {}) =>
        sock.sendMessage(jid, { forward: m, force }, options);
    m.download = (saveToFile = false) => fetchMedia(sock, m, body, mediaType, saveToFile);

    return m;
}
