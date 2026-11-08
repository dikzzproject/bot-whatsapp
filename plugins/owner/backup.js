const { OWNER_ONLY, isInProtectedDir, locate, toRelative } = ownerKit;

const DATA_FILES = ["users.json", "groups.json", "settings.json", "jadibot.json"];
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");

export default {
    ...OWNER_ONLY,
    command: ["backup"],
    help: ["backup [filename]"],
    exec: async (m, { sock, db, text }) => {
        const dir = ensureDir(path.join(config.paths.tmp, "backup"));

        if (!text) {
            db.flush();
            const bundle = { createdAt: new Date().toISOString(), bot: config.bot.name, files: {} };
            for (const name of DATA_FILES) {
                const file = path.join(config.paths.data, name);
                if (fs.existsSync(file)) bundle.files[name] = JSON.parse(fs.readFileSync(file, "utf8"));
            }
            const name = `backup-${stamp()}.json`;
            const buffer = Buffer.from(JSON.stringify(bundle));
            fs.writeFileSync(path.join(dir, name), buffer);
            return sock.sendMessage(
                m.chat,
                { document: buffer, mimetype: "application/json", fileName: name, caption: `💾 Backup pangkalan data (${formatBytes(buffer.length)})\nTurut disimpan di tmp/backup/${name}` },
                { quoted: m }
            );
        }

        const file = locate(text);
        if (!fs.statSync(file).isFile()) throw new UserError("Hanya fail boleh di-backup.");
        if (isInProtectedDir(file)) throw new UserError("Laluan dilindungi.");
        const name = `${stamp()}-${path.basename(file)}`;
        fs.copyFileSync(file, path.join(dir, name));
        return sock.sendMessage(
            m.chat,
            { document: fs.readFileSync(file), mimetype: "application/octet-stream", fileName: path.basename(file), caption: `💾 Backup ${toRelative(file)}\nTurut disimpan di tmp/backup/${name}` },
            { quoted: m }
        );
    }
};
