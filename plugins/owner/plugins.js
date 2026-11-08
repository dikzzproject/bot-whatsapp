const { getPlugins, loadFile, unloadFile } = pluginLoader;
const { OWNER_ONLY, ROOT, checkSyntaxFile, sendOutput, toRelative } = ownerKit;

const PLUGIN_DIR = path.join(ROOT, "plugins");
const HELPER_PREFIX = "_ownerkit";

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith(".js") && !entry.name.startsWith(HELPER_PREFIX) ? [full] : [];
    });
}

const relativePlugin = file => path.relative(PLUGIN_DIR, file).split(path.sep).join("/");

function findPluginFile(name, { disabled }) {
    const wanted = name.replace(/\.js$/, "").replace(/^_/, "");
    const matches = walk(PLUGIN_DIR).filter(file => {
        const base = path.basename(file, ".js");
        const isDisabled = base.startsWith("_");
        if (isDisabled !== disabled) return false;
        const clean = base.replace(/^_/, "");
        return clean === wanted || relativePlugin(file).replace(/\.js$/, "").replace(/\/_/, "/") === wanted;
    });
    if (!matches.length) throw new UserError(`Plugin "${name}" ${disabled ? "yang dilumpuhkan" : "yang aktif"} tidak dijumpai.`);
    if (matches.length > 1) throw new UserError(`Beberapa plugin sepadan, nyatakan laluan:\n${matches.map(file => `• ${relativePlugin(file)}`).join("\n")}`);
    return matches[0];
}

export default [
    {
        ...OWNER_ONLY,
        command: ["plugin", "plugins"],
        help: ["plugin"],
        exec: (m, ctx) => {
            const loaded = new Set(getPlugins().map(plugin => plugin.file));
            const groups = new Map();
            for (const file of walk(PLUGIN_DIR)) {
                const folder = path.basename(path.dirname(file));
                const base = path.basename(file);
                const icon = base.startsWith("_") ? "🚫" : loaded.has(file) ? "✅" : "⚠️";
                if (!groups.has(folder)) groups.set(folder, []);
                groups.get(folder).push(`${icon} ${base}`);
            }
            const body = [...groups].map(([folder, items]) => `*${folder}*\n${items.join("\n")}`).join("\n\n");
            return sendOutput(m, ctx, `🔌 *Plugin*\n✅ aktif  🚫 dilumpuhkan  ⚠️ tidak dimuat\n\n${body}`);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["plug"],
        help: ["plug <enable/disable> <filename>"],
        needText: true,
        exec: async (m, { args, prefix }) => {
            const action = (args[0] ?? "").toLowerCase();
            const name = args[1];
            if (!["enable", "disable"].includes(action) || !name) {
                throw new UserError(`Guna: ${prefix}plug <enable/disable> <nama_fail>`);
            }

            if (action === "disable") {
                const file = findPluginFile(name, { disabled: false });
                if (relativePlugin(file).startsWith("owner/")) throw new UserError("Plugin dalam folder owner dilindungi.");
                const target = path.join(path.dirname(file), `_${path.basename(file)}`);
                fs.renameSync(file, target);
                unloadFile(file);
                return m.reply(`🚫 Dilumpuhkan: ${relativePlugin(file)}`);
            }

            const file = findPluginFile(name, { disabled: true });
            const target = path.join(path.dirname(file), path.basename(file).replace(/^_/, ""));
            fs.renameSync(file, target);
            const count = await loadFile(target);
            return m.reply(`✅ Diaktifkan: ${relativePlugin(target)} (${count} plugin dimuat)`);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["checkplugin", "checkplug"],
        help: ["checkplugin [filename | all]"],
        exec: async (m, ctx) => {
            const input = (ctx.text || "all").trim();
            const all = walk(PLUGIN_DIR).filter(file => !path.basename(file).startsWith("_"));
            const files = /^all$/i.test(input)
                ? all
                : all.filter(file => relativePlugin(file).replace(/\.js$/, "").endsWith(input.replace(/\.js$/, "")));
            if (!files.length) throw new UserError(`Plugin "${input}" tidak dijumpai.`);

            const loaded = new Set(getPlugins().map(plugin => plugin.file));
            const lines = [];
            let failed = 0;
            for (const file of files) {
                const error = await checkSyntaxFile(file);
                if (error) {
                    failed++;
                    lines.push(`❌ ${relativePlugin(file)}\n${error}`);
                } else {
                    lines.push(`${loaded.has(file) ? "✅" : "⚠️ tidak dimuat:"} ${relativePlugin(file)}`);
                }
            }
            return sendOutput(m, ctx, `🔍 *Semakan Plugin* (${files.length} fail, ${failed} ralat)\n\n${lines.join("\n")}`);
        }
    }
];
