import http from "node:http";
import "./manager.js";
import "./accounts.js";
import "./msgjadibot.js";

const web = () => config.jadibot.web;
const COOKIE = "sid";
const MAX_BODY = 30000;
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon"
};

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const hits = new Map();
const routes = [];

function limit(key, max, windowMs = web().rateLimit.windowMs) {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter(time => now - time < windowMs);
    if (recent.length >= max) {
        hits.set(key, recent);
        throw new HttpError(429, "Terlalu banyak percubaan. Cuba lagi sebentar.");
    }
    recent.push(now);
    hits.set(key, recent);
}

const add = (method, pattern, options, handler) => {
    routes.push({
        method,
        regex: new RegExp(`^${pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`),
        auth: Boolean(options.auth),
        handler
    });
};

const clientIp = req =>
    (web().trustProxy && req.headers["x-forwarded-for"]?.split(",")[0].trim()) || req.socket.remoteAddress || "unknown";

const parseCookies = header =>
    Object.fromEntries(
        String(header ?? "")
            .split(";")
            .map(part => part.trim().split("="))
            .filter(([key]) => key)
            .map(([key, ...value]) => [key, decodeURIComponent(value.join("="))])
    );

const isSecure = req => req.headers["x-forwarded-proto"] === "https" || web().publicUrl.startsWith("https://");

const cookieHeader = (req, token, maxAgeSeconds) =>
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${isSecure(req) ? "; Secure" : ""}`;

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", chunk => {
            size += chunk.length;
            if (size > MAX_BODY) {
                reject(new HttpError(413, "Permintaan terlalu besar."));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => {
            if (!chunks.length) return resolve({});
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch {
                reject(new HttpError(400, "JSON tidak sah."));
            }
        });
        req.on("error", reject);
    });
}

function sendJson(res, status, data, headers = {}) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
        ...headers
    });
    res.end(body);
}

function securityHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: https:; connect-src 'self' https://accounts.google.com"
    );
}

function serveStatic(req, res, pathname) {
    const root = path.resolve(config.paths.web);
    let file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!file.startsWith(root + path.sep) && file !== root) throw new HttpError(403, "Dilarang.");
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
    const type = MIME[path.extname(file)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=300" });
    fs.createReadStream(file).pipe(res);
}

const requireOwned = (account, id) => {
    const record = db.jadibot.getSession(id);
    if (!record || record.accountEmail !== account.email) throw new HttpError(404, "Jadibot tidak dijumpai.");
    return record;
};

async function withQr(id) {
    const info = jadibot.describe(id);
    const live = jadibot.getSession(id);
    const qr = live?.qr ? await QRCode.toDataURL(live.qr, { margin: 1, width: 320 }) : "";
    return { ...info, qr };
}

const summary = id => {
    const { settings, ...rest } = jadibot.describe(id);
    return rest;
};

function loginResponse(req, res, account) {
    const { token } = accounts.createLogin(account.email);
    sendJson(res, 200, { ok: true, account: accounts.publicAccount(account) }, { "Set-Cookie": cookieHeader(req, token, web().sessionDays * 86400) });
}

add("GET", "/api/config", {}, () => {
    const defaults = config.jadibot.defaults.messages;
    return {
        botName: config.bot.name,
        googleClientId: web().googleClientId,
        requiresInvite: Boolean(web().accessCode),
        minPassword: web().minPassword,
        maxBots: config.jadibot.maxPerUser,
        enabled: config.jadibot.enabled,
        placeholders: jadibot.getPlaceholders(),
        messageKeys: Object.fromEntries(global.botConfig.getMessageKeys().map(key => [key, defaults[key] ?? config.messages[key] ?? ""]))
    };
});

add("POST", "/api/auth/register", {}, async ({ body, ip, req, res }) => {
    limit(`register:${ip}`, 5);
    if (web().accessCode && body.invite !== web().accessCode) throw new HttpError(403, "Kod jemputan salah.");
    const account = await accounts.registerAccount(body);
    return loginResponse(req, res, account);
});

add("POST", "/api/auth/login", {}, async ({ body, ip, req, res }) => {
    limit(`login:${ip}:${String(body.email).toLowerCase()}`, 8);
    const account = await accounts.loginWithPassword(body.email, body.password);
    return loginResponse(req, res, account);
});

add("POST", "/api/auth/google", {}, async ({ body, ip, req, res }) => {
    limit(`google:${ip}`, 15);
    const account = await accounts.loginWithGoogle(body.credential);
    return loginResponse(req, res, account);
});

add("POST", "/api/auth/forgot", {}, async ({ body, ip, req }) => {
    limit(`forgot:${ip}`, 5);
    accounts.validateEmail(body.email);
    await accounts.startReset(body.email, accounts.baseUrl(req)).catch(error => log.error("web", "Gagal memulakan reset", error));
    return { message: "Jika email itu berdaftar, pautan tetapan semula telah dihantar (email dan/atau WhatsApp)." };
});

add("POST", "/api/auth/reset", {}, async ({ body, ip, req, res }) => {
    limit(`reset:${ip}`, 10);
    const email = await accounts.finishReset(body.token, body.password);
    return loginResponse(req, res, db.accounts.find(email));
});

add("POST", "/api/auth/logout", {}, ({ req, res, token }) => {
    accounts.destroyLogin(token);
    sendJson(res, 200, { ok: true }, { "Set-Cookie": cookieHeader(req, "", 0) });
});

add("GET", "/api/me", { auth: true }, ({ account }) => ({
    account: accounts.publicAccount(account),
    bots: db.jadibot.listByEmail(account.email).map(item => summary(item.id))
}));

add("PATCH", "/api/me", { auth: true }, ({ account, body }) => {
    const patch = {};
    if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 40);
    if (body.waNumber !== undefined) patch.waNumber = cleanNumber(body.waNumber).slice(0, 15);
    return { account: accounts.publicAccount(db.accounts.update(account.email, patch)) };
});

add("POST", "/api/me/password", { auth: true }, async ({ account, body, ip }) => {
    limit(`pass:${ip}`, 8);
    await accounts.changePassword(account, body.current, body.next);
    return { message: "Kata laluan ditukar. Sila log masuk semula." };
});

add("DELETE", "/api/me", { auth: true }, async ({ account, body, req, res }) => {
    if (String(body.confirm).toLowerCase() !== account.email) throw new HttpError(400, "Taip email anda untuk mengesahkan.");
    if (account.passHash && !(await accounts.verifyPassword(body.password, account))) throw new HttpError(400, "Kata laluan salah.");
    const removed = await accounts.removeAccount(account.email);
    sendJson(res, 200, { ok: true, removedBots: removed }, { "Set-Cookie": cookieHeader(req, "", 0) });
});

add("GET", "/api/bots", { auth: true }, ({ account }) => ({
    bots: db.jadibot.listByEmail(account.email).map(item => summary(item.id))
}));

add("POST", "/api/bots", { auth: true }, async ({ account, body }) => {
    limit(`create:${account.email}`, 5);
    const method = body.method === "qr" ? "qr" : "pairing";
    const info = await jadibot.createSession({
        name: body.name,
        method,
        pairNumber: method === "pairing" ? body.number : "",
        requesterParts: [],
        ownerKey: account.ownerIds[0] ?? `web:${account.email}`,
        accountEmail: account.email,
        source: "web"
    });
    return { bot: info };
});

add("GET", "/api/bots/:id", { auth: true }, async ({ account, params }) => {
    requireOwned(account, params.id);
    return { bot: await withQr(params.id) };
});

add("PATCH", "/api/bots/:id/settings", { auth: true }, ({ account, params, body }) => {
    requireOwned(account, params.id);
    return { bot: jadibot.updateSettings(params.id, body) };
});

add("POST", "/api/bots/:id/messages/reset", { auth: true }, ({ account, params, body }) => {
    requireOwned(account, params.id);
    return { bot: jadibot.resetMessages(params.id, body.key ?? "all") };
});

add("POST", "/api/bots/:id/owners", { auth: true }, ({ account, params, body }) => {
    requireOwned(account, params.id);
    if (!["add", "del"].includes(body.action)) throw new HttpError(400, "Tindakan tidak sah.");
    return { bot: jadibot.setOwner(params.id, body.action, body.number) };
});

add("POST", "/api/bots/:id/restart", { auth: true }, async ({ account, params }) => {
    requireOwned(account, params.id);
    limit(`restart:${params.id}`, 6);
    await jadibot.restartSession(params.id);
    return { bot: jadibot.describe(params.id) };
});

add("DELETE", "/api/bots/:id", { auth: true }, async ({ account, params }) => {
    requireOwned(account, params.id);
    await jadibot.killSession(params.id, { reason: "Dipadam melalui dashboard web." });
    return {};
});

export async function handleRequest(req, res) {
    securityHeaders(res);
    try {
        const url = new URL(req.url, "http://localhost");
        const pathname = decodeURIComponent(url.pathname);

        if (!pathname.startsWith("/api/")) {
            if (!["GET", "HEAD"].includes(req.method)) throw new HttpError(405, "Kaedah tidak dibenarkan.");
            return serveStatic(req, res, pathname);
        }

        const route = routes.find(item => item.method === req.method && item.regex.test(pathname));
        if (!route) throw new HttpError(404, "Laluan tidak wujud.");

        if (req.method !== "GET") {
            if (req.headers["x-requested-with"] !== "jadibot-panel") throw new HttpError(403, "Permintaan tidak sah.");
            const origin = req.headers.origin;
            if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, "Asal permintaan tidak sah.");
        }

        const token = parseCookies(req.headers.cookie)[COOKIE];
        const account = accounts.readLogin(token);
        if (route.auth && !account) throw new HttpError(401, "Sila log masuk.");

        const context = {
            req,
            res,
            ip: clientIp(req),
            params: route.regex.exec(pathname).groups ?? {},
            query: Object.fromEntries(url.searchParams),
            body: req.method === "GET" ? {} : await readBody(req),
            account,
            token
        };

        const result = await route.handler(context);
        if (!res.writableEnded && !res.headersSent) sendJson(res, 200, { ok: true, ...(result ?? {}) });
    } catch (error) {
        if (res.headersSent) return res.end();
        if (error instanceof HttpError) return sendJson(res, error.status, { ok: false, message: error.message });
        if (error instanceof UserError) return sendJson(res, 400, { ok: false, message: error.message });
        log.error("htmljadibot", `Ralat ${req.method} ${req.url}`, error);
        return sendJson(res, 500, { ok: false, message: "Ralat dalaman pelayan." });
    }
}

export default function startHtmlJadibot() {
    if (!web().enabled) return Promise.resolve(null);

    const server = http.createServer(handleRequest);
    const purge = setInterval(() => db.accounts.purge(), 10 * 60 * 1000);
    purge.unref();
    server.on("close", () => clearInterval(purge));

    return new Promise(resolve => {
        server.on("error", error => {
            log.error("htmljadibot", `Gagal membuka port ${web().port}`, error);
            resolve(null);
        });
        server.listen(web().port, web().host, () => {
            log.success("htmljadibot", `Dashboard jadibot aktif di http://localhost:${web().port}`);
            resolve(server);
        });
    });
}
