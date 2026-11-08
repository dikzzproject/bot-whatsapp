import db from "#database";
import log from "#logger";
import onCall from "./call.js";
import onGroupParticipants from "./group.js";
import onMessages from "./messages.js";

const guard = (name, handler) => async (...args) => {
    try {
        await handler(...args);
    } catch (error) {
        log.error("events", `Ralat pada event "${name}"`, error);
    }
};

export default function registerEvents(sock) {
    sock.ev.on("messages.upsert", guard("messages.upsert", payload => onMessages(sock, payload)));
    sock.ev.on("group-participants.update", guard("group-participants.update", update => onGroupParticipants(sock, update)));
    sock.ev.on("groups.update", updates => updates.forEach(update => sock.forgetGroup(update.id)));
    sock.ev.on("call", guard("call", calls => onCall(sock, calls)));

    sock.ev.on("contacts.upsert", contacts => {
        for (const contact of contacts) {
            const name = contact.name || contact.notify;
            if (name) sock.names.set(String(contact.id).split("@")[0], name);
        }
    });

    sock.ev.on("connection.update", ({ connection }) => {
        if (connection !== "open") return;
        const presence = db.settings.statusOnline ? "available" : "unavailable";
        Promise.resolve(sock.sendPresenceUpdate(presence)).catch(() => null);
    });

    return sock;
}
