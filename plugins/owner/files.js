const { loadFile, unloadFile } = pluginLoader;
const { OWNER_ONLY, ROOT, checkSyntaxCode, isInProtectedDir, isProtected, locate, moveToTrash, resolveSafe, sendOutput, toRelative } = ownerKit;

const TREE_IGNORED = new Set(["node_modules", ".git"]);
const TREE_MAX_DEPTH = 3;
const TREE_MAX_LINES = 400;
const CAT_MAX_BYTES = 200 * 1024;
const MIME = {
    ".js": "text/javascript",
    ".json": "application/json",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".html": "text/html",
    ".css": "text/css",
    ".log": "text/plain"
};

const sortEntries = entries =>
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

const readDir = dir => sortEntries(fs.readdirSync(dir, { withFileTypes: true }));

function listDirectory(dir) {
    const lines = readDir(dir).map(entry =>
        entry.isDirectory() ? `📁 ${entry.name}/` : `📄 ${entry.name} (${formatBytes(fs.statSync(path.join(dir, entry.name)).size)})`
    );
    return `📂 *${toRelative(dir)}*\n\n${lines.join("\n") || "(kosong)"}`;
}

function buildTree(dir, prefix = "", depth = 0, lines = []) {
    if (depth >= TREE_MAX_DEPTH || lines.length >= TREE_MAX_LINES) return lines;
    const entries = readDir(dir).filter(entry => !TREE_IGNORED.has(entry.name));
    entries.forEach((entry, index) => {
        const last = index === entries.length - 1;
        lines.push(`${prefix}${last ? "└── " : "├── "}${entry.name}${entry.isDirectory() ? "/" : ""}`);
        if (entry.isDirectory()) buildTree(path.join(dir, entry.name), `${prefix}${last ? "    " : "│   "}`, depth + 1, lines);
    });
    return lines;
}

const isPluginFile = absolute =>
    absolute.startsWith(path.join(ROOT, "plugins") + path.sep) &&
    absolute.endsWith(".js") &&
    !path.basename(absolute).startsWith("_");

const syncPlugin = async (before, after) => {
    if (before && isPluginFile(before)) unloadFile(before);
    if (after && isPluginFile(after) && fs.existsSync(after)) await loadFile(after);
};

export default [
    {
        ...OWNER_ONLY,
        command: ["listfile", "ls", "tree", "lf"],
        help: ["listfile", "ls", "tree", "lf [folder_path]"],
        exec: (m, ctx) => {
            const dir = ctx.text ? locate(ctx.text) : ROOT;
            if (!fs.statSync(dir).isDirectory()) throw new UserError("Itu bukan folder.");
            if (ctx.command === "tree") {
                return sendOutput(m, ctx, `🌳 ${toRelative(dir)}/\n${buildTree(dir).join("\n")}`);
            }
            return sendOutput(m, ctx, listDirectory(dir));
        }
    },
    {
        ...OWNER_ONLY,
        command: ["getfile", "gf"],
        help: ["getfile", "gf <filename | path>"],
        needText: true,
        exec: async (m, { sock, text }) => {
            const file = locate(text);
            if (!fs.statSync(file).isFile()) throw new UserError("Itu bukan fail.");
            await sock.sendMessage(
                m.chat,
                {
                    document: fs.readFileSync(file),
                    mimetype: MIME[path.extname(file)] ?? "application/octet-stream",
                    fileName: path.basename(file)
                },
                { quoted: m }
            );
        }
    },
    {
        ...OWNER_ONLY,
        command: ["cat"],
        help: ["cat <filename | path>"],
        needText: true,
        exec: (m, ctx) => {
            const file = locate(ctx.text);
            const stat = fs.statSync(file);
            if (!stat.isFile()) throw new UserError("Itu bukan fail.");
            if (stat.size > CAT_MAX_BYTES) throw new UserError(`Fail terlalu besar (${formatBytes(stat.size)}). Guna .getfile.`);
            const content = fs.readFileSync(file, "utf8");
            if (content.includes("\0")) throw new UserError("Fail binari tidak boleh dipaparkan. Guna .getfile.");
            return sendOutput(m, ctx, content);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["delfile", "deletefile", "df"],
        help: ["delfile", "deletefile", "df <filename | relative_path>"],
        needText: true,
        exec: async (m, { text }) => {
            const file = locate(text);
            if (!fs.statSync(file).isFile()) throw new UserError("Hanya fail boleh dipadam, bukan folder.");
            if (isProtected(file)) throw new UserError(`Fail dilindungi: ${toRelative(file)}`);
            const trash = moveToTrash(file);
            await syncPlugin(file, null);
            return m.reply(`🗑️ Dipadam: ${toRelative(file)}\nSalinan: ${trash}`);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["mv", "movefile", "renamefile", "rf"],
        help: ["mv", "movefile", "renamefile", "rf <old_path> <new_path>"],
        needText: true,
        exec: async (m, { args, prefix }) => {
            if (args.length < 2) throw new UserError(`Guna: ${prefix}mv <laluan_lama> <laluan_baru>`);
            const from = locate(args[0]);
            const to = resolveSafe(args[1]);
            if (isProtected(from) || isInProtectedDir(to)) throw new UserError("Laluan dilindungi.");
            if (fs.existsSync(to)) throw new UserError(`Sasaran sudah wujud: ${toRelative(to)}`);
            fs.mkdirSync(path.dirname(to), { recursive: true });
            fs.renameSync(from, to);
            await syncPlugin(from, to);
            return m.reply(`✅ ${toRelative(from)} → ${toRelative(to)}`);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["savefile", "addfile", "sf", "af"],
        help: ["savefile", "addfile", "sf <path/filename.js> [code]", "af <path/filename.js> [code]"],
        needText: true,
        exec: async (m, { text, prefix }) => {
            const match = text.match(/^(\S+)(?:\s+([\s\S]*))?$/);
            const target = resolveSafe(match[1]);
            if (isInProtectedDir(target)) throw new UserError("Laluan dilindungi.");

            let content = match[2]?.trim() || m.quoted?.text || "";
            if (!content && m.quoted?.isMedia) content = await m.quoted.download();
            if (!content || !content.length) throw new UserError(`Sertakan kod selepas laluan atau balas mesej/dokumen.\nContoh: ${prefix}sf plugins/tools/hai.js <kod>`);

            if (typeof content === "string" && /\.(m?js)$/.test(target)) {
                const error = await checkSyntaxCode(content);
                if (error) throw new UserError(`❌ Ralat sintaks, fail tidak disimpan:\n${error}`);
            }

            const existed = fs.existsSync(target);
            if (existed) {
                if (!fs.statSync(target).isFile()) throw new UserError("Sasaran ialah folder.");
                moveToTrash(target, { copy: true });
            }
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, content);
            await syncPlugin(null, target);

            const size = Buffer.byteLength(content);
            return m.reply(`✅ ${existed ? "Dikemas kini" : "Disimpan"}: ${toRelative(target)} (${formatBytes(size)})${isPluginFile(target) ? "\n🔌 Plugin dimuat semula." : ""}`);
        }
    }
];
