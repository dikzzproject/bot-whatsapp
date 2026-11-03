import fs from "fs";
import path from "path";
import readline from "readline/promises";
import QRCode from "qrcode";
import config from "#config/global.js";
import log from "#logger";
import db from "#database";
import makeSocket from "#client/makeSocket.js";
import { bindConnection } from "#client/connection.js";
import registerEvents from "#events/index.js";
import { setOfficial } from "#lib/registry.js";
import { cleanNumber } from "#lib/utils.js";

const SESSION_PATH = path.join(config.paths.auth, "official");
let attempts = 0;
let reconnectTimer = null;

const hasSession = () => fs.existsSync(path.join(SESSION_PATH, "creds.json"));

async function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        return (await rl.question(question)).trim();
    } finally {
        rl.close();
    }
}

async function resolveLogin() {
    if (hasSession()) return { method: "session", number: "" };

    let method = config.official.loginMethod;
    if (method !== "pairing" && method !== "qr") {
        const choice = await ask("Official bot login method:\n  1) Pairing code\n  2) QR code\nSelect [1/2]: ");
        method = choice === "2" ? "qr" : "pairing";
    }

    if (method === "qr") return { method, number: "" };

    let number = cleanNumber(config.official.number);
    if (number.length < 8) number = cleanNumber(await ask("Bot number (e.g. 60123456789): "));
    return { method, number };
}

async function printQr(qr) {
    const art = await QRCode.toString(qr, { type: "terminal", small: true });
    log.info("qr", `Scan this QR code via WhatsApp > Linked Devices:\n${art}`);
}

async function announceOpen(sock) {
    if (!config.official.notifyOnOpen) return;
    const target = sock.botJid;
    if (!target) return;
    await sock
        .sendMessage(target, {
            text: `*${config.bot.name} connected*\n\nNumber : ${sock.botNumber}\nVersion  : ${config.bot.version}`
        })
        .catch(() => null);
}

async function connect(login) {
    const sock = await makeSocket({ sessionPath: SESSION_PATH, role: "official", number: login.number });
    setOfficial(sock);
    registerEvents(sock);

    bindConnection(sock, {
        pairingNumber: login.method === "pairing" ? login.number : "",
        onQr: printQr,
        onPairing: code =>
            log.info(
                "pairing",
                `WhatsApp > Linked Devices > Link with phone number\nNumber : ${login.number}\nCode   : ${code}`
            ),
        onPairingError: error => log.error("pairing", "Failed to request pairing code", error),
        onConnecting: () => log.warn("connection", "Connecting to WhatsApp..."),
        onOpen: async () => {
            attempts = 0;
            log.success("connection", `Official bot active: ${sock.botNumber}`);
            await announceOpen(sock);
        },
        onClose: ({ reason, permanent }) => {
            log.warn("connection", `Connection closed: ${reason}`);
            if (permanent) {
                fs.rmSync(SESSION_PATH, { recursive: true, force: true });
                log.warn("auth", "Session deleted. Re-login will be initiated.");
                reconnectTimer = setTimeout(() => startOfficialBot(), config.official.reconnectDelay);
                return;
            }
            attempts++;
            const delay = Math.min(30000, config.official.reconnectDelay * attempts);
            reconnectTimer = setTimeout(() => connect({ method: "session", number: login.number }), delay);
        }
    });

    return sock;
}

export async function startOfficialBot() {
    clearTimeout(reconnectTimer);
    const login = await resolveLogin();
    db.start();
    return connect(login);
}

export default startOfficialBot;
