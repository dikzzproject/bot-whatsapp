import db from "#database";

export default async function onCall(sock, calls) {
    if (!db.settings.rejectCall) return;
    for (const call of calls) {
        if (call.status !== "offer") continue;
        await sock.rejectCall(call.id, call.from);
        await sock.sendMessage(call.from, { text: config.messages.rejectCall });
        if (db.settings.callBlock)
            await sock.updateBlockStatus(call.from, "block").catch(() => null);
    }
}
