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
        version: pkg.version || "0.1-beta",
        timezone: "Asia/Kuala_Lumpur", // sesuaikan
        debug: toFlag(env.DEBUG, false)
    },

    owner: {
        name: ["", ""],
        number: [""],
        username: ["", ""],
        userkey: ["", ""]
    },

   link: {
      web: env.LINK_WEB || "",
      sgc: env.LINK_SGC || "",
      sch: env.LINK_SCH || ""
   },

   apikey: {
      gemini: {
         api: env.API_GEMINI || "",
         model: "gemini-2.5-flash",
         chatCharModel: "gemini-3.1-flash-lite"
      }
   },
   
   newsletter: {
      id: env.CH_ID || "",
      name: env.CH_NAME || ""
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
        defaults: {
            prefix: [".", "!", "/"],
            mode: "public",
            limit: { daily: 0 },
            messages: {
                loading: "⏳ Sila tunggu sebentar...",
                botMessage:
                    "Hai {user}! Saya *{botname}*.\nTaip {prefix}menu untuk senarai arahan.",
                ownerOnly: "",
                groupOnly: "",
                privateOnly: "",
                adminOnly: "",
                botAdminOnly: "",
                premiumOnly: "",
                registerFirst: "",
                banned: "",
                noLimit: "",
                dailyLimit: "",
                cooldown: "",
                error: ""
            }
        },
        web: {
            enabled: toFlag(env.WEB_ENABLED, true),
            host: env.HOST || "0.0.0.0",
            port: Number(env.PORT) || 3000,
            publicUrl: env.PUBLIC_URL || "",
            accessCode: env.WEB_ACCESS_CODE || "",
            googleClientId: env.GOOGLE_CLIENT_ID || "",
            trustProxy: toFlag(env.TRUST_PROXY, false),
            sessionDays: 14,
            resetMinutes: 30,
            minPassword: 8,
            smtp: {
                host: env.SMTP_HOST || "",
                port: Number(env.SMTP_PORT) || 587,
                user: env.SMTP_USER || "",
                pass: env.SMTP_PASS || "",
                from: env.SMTP_FROM || ""
            },
            rateLimit: { windowMs: 10 * 60 * 1000, max: 12 }
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
        registerFirst: "📝 Anda perlu daftar dahulu. Taip: {prefix}daftar",
        banned: "🚫 Anda disekat daripada menggunakan bot ini.",
        noLimit: "🔋 Limit anda tidak mencukupi. Perlukan {cost} limit.",
        cooldown: "⏳ Sila tunggu {time} sebelum guna arahan ini lagi.",
        maintenance: "🔧 Arahan ini sedang dalam penyelenggaraan.",
        blacklisted: "⛔ Anda atau kumpulan ini tidak dibenarkan menggunakan arahan itu.",
        officialOnly: "🏛️ Arahan ini hanya boleh digunakan pada bot rasmi.",
        jadibotBlocked: "🚧 Arahan ini tidak dibenarkan pada jadibot.",
        needMedia: "🖼️ Hantar atau balas media jenis: {types}.",
        rejectCall: "Maaf, bot tidak menerima panggilan.",
        loading: "⏳ Sila tunggu sebentar...",
        dailyLimit: "📅 Had harian bot ini ({limit} arahan) telah dicapai. Cuba lagi esok.",
        botMessage: "Hai {user}! Taip {prefix}menu untuk senarai arahan."
    }
};

global.bot = global.config.bot;
global.app = { name: global.config.bot.name, version: global.config.bot.version };
global.year = String(new Date().getFullYear());

global.lopr = "🄾";
global.loadm = "🄰";
global.loprm = "🄿";
global.lolm = "🄻";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

global.listImages = (dir = global.config.paths.mediaImage) => {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter(file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
        .map(file => path.join(dir, file));
};

global.randomImage = (dir = global.config.paths.mediaImage) => {
    const files = global.listImages(dir);
    if (!files.length) return null;
    return fs.readFileSync(files[Math.floor(Math.random() * files.length)]);
};

global.thumbnail = (dir = global.config.paths.mediaImage) => {
    const files = global.listImages(dir);
    if (!files.length) return null;
    const file = files[Math.floor(Math.random() * files.length)];
    return { buffer: fs.readFileSync(file), path: file, name: path.basename(file) };
};

global.defaultAvatar = () => {
    const file = path.join(global.config.paths.mediaDefault, "avatar.jpg");
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
};

export default global.config;