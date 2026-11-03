import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const env = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
);

const toFlag = (value, fallback) =>
    value === undefined || value === "" || value === null
        ? fallback
        : !["false", "0", "off", "no"].includes(String(value).toLowerCase());

const fromRoot = (...parts) => path.join(root, ...parts);

global.config = {
    bot: {
        name: env.BOT_NAME || "App Bot WhatsApp",
        version: pkg.version,
        timezone: "Asia/Kuala_Lumpur", // sesuaikan
        debug: toFlag(env.DEBUG, false)
    },

    owner: {
        name: "Dikz",
        number: ["601143030730", "6285111509070", "131624289210464"],
        username: ["rinn_draw", ""],
        userkey: ["8900", ""]
    },

    prefix: [".", "!", "/"],

    official: {
        number: env.BOT_NUMBER || "",
        loginMethod: env.LOGIN_METHOD || "ask", // qr
        reconnectDelay: 5000,
        notifyOnOpen: false
    },

    baileys: {
        logLevel: "silent",
        browserName: "Firefox"
    },

    jadibot: {
        enabled: true,
        free: toFlag(env.JADIBOT_FREE, true),
        maxActive: 20,
        maxPerUser: 1,
        pairTimeoutMs: 120000,
        reconnectDelay: 8000,
        maxReconnect: 8,
        restoreOnStart: true,
        blockedCommands: [],
        web: {
            enabled: toFlag(env.WEB_ENABLED, true),
            host: env.HOST || "0.0.0.0",
            port: Number(env.PORT) || 3000,
            accessCode: env.WEB_ACCESS_CODE || "",
            rateLimit: { windowMs: 10 * 60 * 1000, max: 6 }
        }
    },

    plugins: {
        watch: toFlag(env.WATCH_PLUGINS, true)
    },

    economy: {
        defaultLimit: 100,
        startMoney: 1000,
        registerBonus: { money: 500, limit: 20, exp: 100 }
    },

    menu: {
        categoryOrder: [
            "main",
            "info",
            "xp",
            "group",
            "tools",
            "downloader",
            "fun",
            "game",
            "rpg",
            "jadibot"
        ],
        icons: { limit: "🄻", premium: "🄿", owner: "🄾" }
    },

    paths: {
        root,
        auth: fromRoot("auth"),
        data: fromRoot("database", "data"),
        plugins: fromRoot("plugins"),
        tmp: fromRoot("tmp"),
        web: fromRoot("src", "jadibot", "public"),
        mediaImage: fromRoot("config", "media", "image"),
        mediaDefault: fromRoot("config", "media", "default")
    },

    messages: {
        error: "⚠️ Ralat berlaku semasa memproses arahan.",
        ownerOnly: "🔒 Arahan ini untuk owner sahaja.",
        groupOnly: "👥 Arahan ini hanya boleh digunakan dalam kumpulan.",
        privateOnly: "💬 Arahan ini hanya boleh digunakan dalam chat peribadi.",
        adminOnly: "🛡️ Arahan ini untuk admin kumpulan sahaja.",
        botAdminOnly: "🤖 Jadikan bot sebagai admin kumpulan dahulu.",
        premiumOnly: "💎 Arahan ini untuk pengguna premium sahaja.",
        registerFirst: "📝 Anda perlu daftar dahulu. Taip: {prefix}daftar nama.umur",
        banned: "🚫 Anda disekat daripada menggunakan bot ini.",
        noLimit: "🔋 Limit anda tidak mencukupi. Perlukan {cost} limit.",
        cooldown: "⏳ Sila tunggu {time} sebelum guna arahan ini lagi.",
        maintenance: "🔧 Arahan ini sedang dalam penyelenggaraan.",
        blacklisted: "⛔ Anda atau kumpulan ini tidak dibenarkan menggunakan arahan itu.",
        officialOnly: "🏛️ Arahan ini hanya boleh digunakan pada bot rasmi.",
        jadibotBlocked: "🚧 Arahan ini tidak dibenarkan pada jadibot.",
        needMedia: "🖼️ Hantar atau balas media jenis: {types}.",
        rejectCall: "Maaf, bot tidak menerima panggilan."
    }
};

export default global.config;