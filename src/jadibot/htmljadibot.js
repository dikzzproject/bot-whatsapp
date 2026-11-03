import crypto from "node:crypto";
import express from "express";
import QRCode from "qrcode";
import config from "#config/global.js";
import log from "#logger";
import { cleanNumber } from "#lib/utils.js";
import {
    canStart,
    createQrId,
    getSession,
    isValidId,
    publicInfo,
    startSession,
    stopSession
} from "./manager.js";

const hits = new Map();

const safeEqual = (a, b) => {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const rateLimited = ip => {
    const { windowMs, max } = config.jadibot.web.rateLimit;
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter(time => now - time < windowMs);
    if (recent.length >= max) {
        hits.set(ip, recent);
        return true;
    }
    recent.push(now);
    hits.set(ip, recent);
    return false;
};

const requireAccessCode = (req, res, next) => {
    const required = config.jadibot.web.accessCode;
    if (required && !safeEqual(req.get("x-access-code") ?? "", required)) {
        return res.status(401).json({ ok: false, message: "Kod akses salah." });
    }
    return next();
};

const requireToken = (req, res, next) => {
    const entry = getSession(req.params.id);
    if (!isValidId(req.params.id) || !entry) return res.status(404).json({ ok: false, message: "Sesi tidak dijumpai." });
    if (!safeEqual(req.get("x-session-token") ?? "", entry.token)) {
        return res.status(403).json({ ok: false, message: "Token sesi tidak sah." });
    }
    req.entry = entry;
    return next();
};

export function createHtmlJadibotApp() {
    const app = express();
    app.disable("x-powered-by");
    app.use(express.json({ limit: "10kb" }));
    app.use(express.static(config.paths.web));

    app.get("/api/config", (req, res) => {
        res.json({
            ok: true,
            botName: config.bot.name,
            requiresCode: Boolean(config.jadibot.web.accessCode),
            enabled: config.jadibot.enabled
        });
    });

    app.post("/api/jadibot/start", requireAccessCode, async (req, res) => {
        const method = req.body?.method === "qr" ? "qr" : "pairing";
        const number = cleanNumber(req.body?.number);

        if (rateLimited(req.ip)) {
            return res.status(429).json({ ok: false, message: "Terlalu banyak permintaan. Cuba sebentar lagi." });
        }
        if (method === "pairing" && !/^\d{8,15}$/.test(number)) {
            return res.status(400).json({ ok: false, message: "Nombor tidak sah. Guna format 60123456789." });
        }

        const owner = method === "pairing" ? number : `web-${req.ip}`;
        const check = canStart({ owner: method === "pairing" ? number : "", number });
        if (!check.ok) return res.status(403).json({ ok: false, message: check.message });

        const id = method === "qr" ? createQrId() : number;
        if (getSession(id)) {
            return res.status(409).json({ ok: false, message: "Nombor ini sudah mempunyai sesi aktif." });
        }

        try {
            const entry = await startSession({ id, method, owner, source: "web" });
            return res.json({ ok: true, id: entry.id, token: entry.token });
        } catch (error) {
            log.error("htmljadibot", "Gagal memulakan sesi", error);
            return res.status(500).json({ ok: false, message: "Gagal memulakan sesi." });
        }
    });

    app.get("/api/jadibot/:id", requireToken, async (req, res) => {
        const info = publicInfo(req.entry);
        const qr = req.entry.qr ? await QRCode.toDataURL(req.entry.qr, { margin: 1, width: 320 }) : "";
        res.json({ ok: true, session: { ...info, qr } });
    });

    app.post("/api/jadibot/:id/stop", requireToken, async (req, res) => {
        await stopSession(req.entry.id, { remove: true, reason: "Dihentikan melalui web." });
        res.json({ ok: true });
    });

    app.use("/api", (req, res) => res.status(404).json({ ok: false, message: "Laluan tidak wujud." }));

    return app;
}

export default function startHtmlJadibot() {
    const { web } = config.jadibot;
    if (!web.enabled) return Promise.resolve(null);

    const app = createHtmlJadibotApp();
    return new Promise(resolve => {
        const server = app.listen(web.port, web.host, () => {
            log.success("htmljadibot", `Halaman jadibot aktif di http://localhost:${web.port}`);
            resolve(server);
        });
        server.on("error", error => {
            log.error("htmljadibot", `Gagal membuka port ${web.port}`, error);
            resolve(null);
        });
    });
}
