import db from "#database";
import log from "#logger";
import { defaultAvatar } from "#lib/media.js";
import { jidUser } from "#lib/utils.js";

const DEFAULT_TEXT = {
    welcome: "Selamat datang @user ke *@group* 👋\n\n@desc",
    bye: "Selamat tinggal @user 👋",
    promote: "Tahniah @user, kini anda jadi admin 🎉",
    demote: "@user bukan lagi jadi admin."
};

const ACTION_KEY = { add: "welcome", remove: "bye", promote: "promote", demote: "demote" };

const participantId = participant => (typeof participant === "string" ? participant : participant.id);

const render = (template, { jid, subject, desc }) =>
    template
        .replaceAll("@user", `@${jidUser(jid)}`)
        .replaceAll("@group", subject)
        .replaceAll("@desc", desc || "");

async function getPicture(sock, jid) {
    try {
        return { url: await sock.profilePictureUrl(jid, "image") };
    } catch {
        return defaultAvatar();
    }
}

export default async function onGroupParticipants(sock, update) {
    const { id, participants, action } = update;
    sock.forgetGroup(id);

    const key = ACTION_KEY[action];
    if (!key) return;

    const group = db.groups.get(id);
    if (!group[key]) return;

    const metadata = await sock.getGroupMetadata(id);
    const info = { subject: metadata?.subject ?? "group", desc: metadata?.desc ?? "" };
    const template = group.texts[key] || DEFAULT_TEXT[key];
    const botParts = [sock.botJid, sock.botLid].filter(Boolean).map(jidUser);

    for (const participant of participants) {
        const jid = participantId(participant);
        if (botParts.includes(jidUser(jid))) continue;

        const caption = render(template, { jid, ...info });
        const picture = await getPicture(sock, jid);
        try {
            if (picture) await sock.sendMessage(id, { image: picture, caption, mentions: [jid] });
            else await sock.sendMessage(id, { text: caption, mentions: [jid] });
        } catch (error) {
            log.error("group", `Failed to send message. ${action} to ${id}`, error);
        }
    }
}
