import db from "#database";
import log from "#logger";
import { pickRandom, jidUser } from "#lib/utils.js";

export default async function handleStatus(sock, raw) {
    const options = db.settings.autoReadStatus;
    if (!options.enabled || raw.key.fromMe) return;

    const owner = raw.key.participant || raw.participant;
    if (!owner) return;

    await sock.readMessages([raw.key]);

    if (options.emoji) {
        const emoji = pickRandom(options.emojis);
        await sock.sendMessage(
            "status@broadcast",
            { react: { text: emoji, key: raw.key } },
            { statusJidList: [owner] }
        );
    }
}
