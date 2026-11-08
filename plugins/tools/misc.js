const HASHES = ["md5", "sha1", "sha256", "sha512"];

export default [
    {
        command: ["shorturl", "short", "isgd"],
        help: ["shorturl <pautan>"],
        tags: ["tools"],
        needText: true,
        exec: async (m, { text }) => {
            if (!isUrl(text)) throw new UserError("Pautan mesti bermula dengan http:// atau https://");
            const short = await fetchJson("https://is.gd/create.php", { params: { format: "simple", url: text } });
            return m.reply(`🔗 ${String(short).trim()}`);
        }
    },
    {
        command: ["hash"],
        help: ["hash <md5|sha1|sha256|sha512> <teks>"],
        tags: ["tools"],
        needText: true,
        exec: (m, { args }) => {
            const algorithm = args[0]?.toLowerCase();
            const content = args.slice(1).join(" ");
            if (!HASHES.includes(algorithm) || !content) throw new UserError(`Guna: .hash <${HASHES.join("|")}> <teks>`);
            return m.reply(nodeCrypto.createHash(algorithm).update(content).digest("hex"));
        }
    },
    {
        command: ["genpass", "password"],
        help: ["genpass [panjang 8-64]"],
        tags: ["tools"],
        exec: (m, { args }) => {
            const length = clamp(parseInt(args[0], 10) || 16, 8, 64);
            return m.reply(`🔑 ${randomString(length, "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*")}`);
        }
    },
    {
        command: ["uuid", "guid"],
        help: ["uuid"],
        tags: ["tools"],
        exec: m => m.reply(nodeCrypto.randomUUID())
    },
    {
        command: ["countdown", "baki"],
        help: ["countdown <YYYY-MM-DD>"],
        tags: ["tools"],
        needText: true,
        exec: (m, { text }) => {
            const target = new Date(`${text}T00:00:00`);
            if (Number.isNaN(target.getTime())) throw new UserError("Format tarikh: YYYY-MM-DD");
            const diff = target.getTime() - Date.now();
            return m.reply(diff > 0 ? `⏳ ${formatDuration(diff)} lagi sehingga ${text}.` : `📅 ${text} sudah berlalu ${formatDuration(-diff)} yang lalu.`);
        }
    }
];
