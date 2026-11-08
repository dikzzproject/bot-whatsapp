import { promisify } from "node:util";

const scrypt = promisify(nodeCrypto.scrypt);
const web = () => config.jadibot.web;
const sha256 = value => nodeCrypto.createHash("sha256").update(value).digest("hex");
const normalizeEmail = email => String(email ?? "").trim().toLowerCase();
const MAX_PASSWORD = 128;

let transporter = null;

export async function hashPassword(password, salt = nodeCrypto.randomBytes(16).toString("hex")) {
    const derived = await scrypt(password, salt, 64);
    return { salt, hash: derived.toString("hex") };
}

export async function verifyPassword(password, account) {
    if (!account?.passHash) return false;
    const { hash } = await hashPassword(String(password), account.salt);
    const left = Buffer.from(hash, "hex");
    const right = Buffer.from(account.passHash, "hex");
    return left.length === right.length && nodeCrypto.timingSafeEqual(left, right);
}

export function validatePassword(password) {
    const value = String(password ?? "");
    if (value.length < web().minPassword) throw new UserError(`Kata laluan minimum ${web().minPassword} aksara.`);
    if (value.length > MAX_PASSWORD) throw new UserError(`Kata laluan maksimum ${MAX_PASSWORD} aksara.`);
    return value;
}

export function validateEmail(email) {
    const value = normalizeEmail(email);
    if (!isEmail(value)) throw new UserError("Format email tidak sah.");
    return value;
}

export function publicAccount(account) {
    return {
        email: account.email,
        name: account.name,
        waNumber: account.waNumber,
        hasPassword: Boolean(account.passHash),
        google: Boolean(account.googleSub),
        createdAt: account.createdAt
    };
}

export function createLogin(email) {
    const token = nodeCrypto.randomBytes(32).toString("hex");
    const expires = Date.now() + web().sessionDays * 86400000;
    db.accounts.addLogin(sha256(token), normalizeEmail(email), expires);
    return { token, expires };
}

export function readLogin(token) {
    if (!token) return null;
    const session = db.accounts.getLogin(sha256(token));
    return session ? db.accounts.find(session.email) : null;
}

export const destroyLogin = token => token && db.accounts.removeLogin(sha256(token));

export async function registerAccount({ email, password, name = "", waNumber = "" }) {
    const clean = validateEmail(email);
    validatePassword(password);
    if (db.accounts.find(clean)) throw new UserError("Email ini sudah didaftarkan. Sila log masuk.");
    const { salt, hash } = await hashPassword(password);
    return db.accounts.create({
        email: clean,
        name: String(name).trim().slice(0, 40),
        passHash: hash,
        salt,
        waNumber: cleanNumber(waNumber).slice(0, 15)
    });
}

export async function loginWithPassword(email, password) {
    const account = db.accounts.find(normalizeEmail(email));
    const ok = account ? await verifyPassword(password, account) : (await hashPassword("x"), false);
    if (!ok) throw new UserError("Email atau kata laluan salah.");
    return account;
}

export async function loginWithGoogle(idToken) {
    const clientId = web().googleClientId;
    if (!clientId) throw new UserError("Log masuk Google tidak diaktifkan.");
    const info = await fetchJson("https://oauth2.googleapis.com/tokeninfo", { params: { id_token: idToken } }).catch(() => null);
    if (!info || info.aud !== clientId || String(info.email_verified) !== "true" || !info.email) {
        throw new UserError("Token Google tidak sah.");
    }
    const email = normalizeEmail(info.email);
    let account = db.accounts.findByGoogle(info.sub) ?? db.accounts.find(email);
    if (!account) account = db.accounts.create({ email, name: info.name ?? "", googleSub: info.sub });
    else if (!account.googleSub) db.accounts.update(account.email, { googleSub: info.sub });
    return account;
}

export async function changePassword(account, current, next) {
    if (account.passHash && !(await verifyPassword(current, account))) throw new UserError("Kata laluan semasa salah.");
    validatePassword(next);
    const { salt, hash } = await hashPassword(next);
    db.accounts.update(account.email, { passHash: hash, salt });
    db.accounts.removeLoginsOf(account.email);
}

export function createWhatsAppAccount({ email, ownerId, waNumber }) {
    const clean = validateEmail(email);
    const existing = db.accounts.find(clean);
    if (existing) {
        if (!existing.ownerIds.includes(ownerId)) throw new UserError("Email ini sudah digunakan oleh pengguna lain. Guna email yang berbeza.");
        return { account: existing, password: null };
    }
    const password = randomString(10);
    return {
        account: null,
        password,
        async commit() {
            const { salt, hash } = await hashPassword(password);
            return db.accounts.create({ email: clean, passHash: hash, salt, waNumber: cleanNumber(waNumber), ownerIds: [ownerId] });
        }
    };
}

export async function resetPasswordForOwner(ownerId) {
    const accounts = db.accounts.findByOwnerId(ownerId);
    if (!accounts.length) throw new UserError("Anda belum mempunyai akaun web. Taip .jadibot untuk mendaftar.");
    const results = [];
    for (const account of accounts) {
        const password = randomString(10);
        const { salt, hash } = await hashPassword(password);
        db.accounts.update(account.email, { passHash: hash, salt });
        db.accounts.removeLoginsOf(account.email);
        results.push({ email: account.email, password });
    }
    return results;
}

export async function removeAccount(email) {
    const clean = normalizeEmail(email);
    const removedBots = await global.jadibot.deleteByAccount(clean);
    db.accounts.remove(clean);
    return removedBots;
}

export const baseUrl = req => {
    if (web().publicUrl) return web().publicUrl.replace(/\/+$/, "");
    const host = req?.headers?.host ?? `localhost:${web().port}`;
    return `http://${host}`;
};

async function getTransport() {
    const smtp = web().smtp;
    if (!smtp.host) return null;
    if (transporter) return transporter;
    try {
        const nodemailer = (await import("nodemailer")).default;
        transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.port === 465,
            auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
        });
        return transporter;
    } catch (error) {
        log.warn("accounts", "nodemailer tidak dipasang, email tidak dapat dihantar.", error.message);
        return null;
    }
}

export async function startReset(email, origin) {
    const account = db.accounts.find(normalizeEmail(email));
    if (!account) return [];

    const token = nodeCrypto.randomBytes(32).toString("hex");
    db.accounts.addReset(sha256(token), account.email, Date.now() + web().resetMinutes * 60000);
    const link = `${origin}/?reset=${token}`;
    const message = `Permintaan tetapan semula kata laluan ${config.bot.name}.\n\nKlik pautan ini dalam ${web().resetMinutes} minit:\n${link}\n\nJika bukan anda, abaikan mesej ini.`;
    const channels = [];

    const transport = await getTransport();
    if (transport) {
        try {
            await transport.sendMail({
                from: web().smtp.from || web().smtp.user,
                to: account.email,
                subject: `${config.bot.name}: tetapan semula kata laluan`,
                text: message
            });
            channels.push("email");
        } catch (error) {
            log.error("accounts", "Gagal menghantar email reset", error);
        }
    }

    const official = registry.official;
    const targets = unique([...(account.ownerIds ?? []), account.waNumber ? toUserJid(account.waNumber) : ""]);
    if (official?.user && targets.length) {
        for (const jid of targets) {
            try {
                await official.sendMessage(jid, { text: message });
                if (!channels.includes("whatsapp")) channels.push("whatsapp");
            } catch {
                continue;
            }
        }
    }

    if (!channels.length) log.warn("accounts", `Tiada saluran untuk menghantar reset kepada ${account.email}. Pautan: ${link}`);
    return channels;
}

export async function finishReset(token, password) {
    validatePassword(password);
    const reset = db.accounts.takeReset(sha256(String(token ?? "")));
    if (!reset) throw new UserError("Pautan tetapan semula tidak sah atau sudah tamat.");
    const { salt, hash } = await hashPassword(password);
    db.accounts.update(reset.email, { passHash: hash, salt });
    db.accounts.removeLoginsOf(reset.email);
    return reset.email;
}

global.accounts = {
    hashPassword,
    verifyPassword,
    validatePassword,
    validateEmail,
    publicAccount,
    createLogin,
    readLogin,
    destroyLogin,
    registerAccount,
    loginWithPassword,
    loginWithGoogle,
    changePassword,
    createWhatsAppAccount,
    resetPasswordForOwner,
    removeAccount,
    startReset,
    finishReset,
    baseUrl
};
