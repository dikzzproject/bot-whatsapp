import { Boom } from "@hapi/boom";
import { DisconnectReason } from "@whiskeysockets/baileys";
import log from "#logger";

export const DISCONNECT_REASONS = {
    400: "Invalid request",
    401: "Session expired, re-login required",
    403: "Access denied by WhatsApp",
    404: "Resource not found",
    408: "Connection timed out.",
    411: "Multi-device versions do not match",
    428: "Connection closed, need to reconnect",
    440: "Sessions clash, log in on another device",
    500: "WhatsApp internal server error",
    503: "WhatsApp server under maintenance",
    515: "Restart required"
};

const PERMANENT_CODES = new Set([
    DisconnectReason.loggedOut,
    DisconnectReason.forbidden,
    DisconnectReason.multideviceMismatch
]);

export const isLinked = sock => Boolean(sock?.authState?.creds?.me?.id);

export const formatPairingCode = code => String(code).match(/.{1,4}/g)?.join("-") ?? String(code);

export function parseDisconnect(lastDisconnect) {
    const code = new Boom(lastDisconnect?.error)?.output?.statusCode ?? 0;
    return {
        code,
        reason: DISCONNECT_REASONS[code] ?? `Unknown (code ${code})`,
        permanent: PERMANENT_CODES.has(code),
        restartRequired: code === DisconnectReason.restartRequired
    };
}

export function bindConnection(sock, handlers = {}) {
    const { pairingNumber = "", onQr, onPairing, onPairingError, onConnecting, onOpen, onClose } = handlers;
    let pairingRequested = false;

    sock.ev.on("connection.update", async update => {
        try {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                if (pairingNumber && !isLinked(sock)) {
                    if (!pairingRequested) {
                        pairingRequested = true;
                        try {
                            const code = await sock.requestPairingCode(pairingNumber);
                            await onPairing?.(formatPairingCode(code), code);
                        } catch (error) {
                            pairingRequested = false;
                            await onPairingError?.(error);
                        }
                    }
                } else if (!pairingNumber) {
                    await onQr?.(qr);
                }
            }

            if (connection === "connecting") await onConnecting?.();
            if (connection === "open") await onOpen?.();
            if (connection === "close") await onClose?.(parseDisconnect(lastDisconnect));
        } catch (error) {
            log.error("connection", "Error in connection handler", error);
        }
    });
}
