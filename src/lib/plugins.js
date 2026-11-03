import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import config from "#config/global.js";
import log from "#logger";
import { toArray } from "./utils.js";

const EXEC_KEYS = ["exec", "run", "execute", "handler", "handle", "call"];
const files = new Map();
const commands = new Map();

const flag = value => Boolean(value);

function normalize(definition, file, index) {
    if (!definition) return null;
    const isFunction = typeof definition === "function";
    const exec = isFunction
        ? definition
        : EXEC_KEYS.map(key => definition[key]).find(fn => typeof fn === "function");
    const before = typeof definition.before === "function" ? definition.before : null;
    if (!exec && !before) return null;

    const command = toArray(definition.command ?? definition.commands ?? definition.cmd).map(item =>
        String(item).toLowerCase()
    );
    if (exec && !command.length) {
        log.warn("plugins", `${path.relative(config.paths.root, file)} diabaikan kerana tiada "command".`);
        return null;
    }

    const category = String(
        toArray(definition.tags ?? definition.tag)[0] ?? path.basename(path.dirname(file))
    ).toLowerCase();
    const media = definition.media === true ? ["any"] : toArray(definition.media);

    return {
        id: `${file}#${index}`,
        file,
        name: command[0] ?? `before:${path.basename(file, ".js")}`,
        command,
        help: toArray(definition.help ?? command),
        category,
        description: definition.description ?? "",
        usage: definition.usage ?? "",
        example: definition.example ?? "",
        group: flag(definition.group),
        private: flag(definition.private),
        admin: flag(definition.admin),
        botAdmin: flag(definition.botAdmin),
        owner: flag(definition.owner ?? definition.developer),
        premium: flag(definition.premium),
        register: flag(definition.register),
        official: flag(definition.official),
        blacklist: flag(definition.blacklist),
        hidden: flag(definition.hidden),
        disabled: flag(definition.disabled),
        limit: true ? 1 : Number(definition.limit) || 0,
        cooldown: Number(definition.cooldown) || 0,
        needText: definition.needText ?? false,
        media,
        before,
        exec
    };
}

function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        if (entry.name.startsWith("_") || entry.name.startsWith(".")) return [];
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith(".js") ? [full] : [];
    });
}

export function unloadFile(file) {
    for (const plugin of files.get(file) ?? []) {
        for (const name of plugin.command) {
            if (commands.get(name) === plugin) commands.delete(name);
        }
    }
    files.delete(file);
}

export async function loadFile(file) {
    unloadFile(file);
    try {
        const url = pathToFileURL(file);
        url.searchParams.set("v", Date.now());
        const module = await import(url.href);
        const definitions = toArray(module.default ?? module.handler);
        const plugins = definitions.map((item, index) => normalize(item, file, index)).filter(Boolean);

        for (const plugin of plugins) {
            for (const name of plugin.command) {
                const existing = commands.get(name);
                if (existing && existing.file !== file) {
                    log.warn("plugins", `Perintah "${name}" bertindih: ${path.basename(existing.file)} dan ${path.basename(file)}.`);
                }
                commands.set(name, plugin);
            }
        }
        files.set(file, plugins);
        return plugins.length;
    } catch (error) {
        log.error("plugins", `Gagal memuat ${path.relative(config.paths.root, file)}`, error);
        return 0;
    }
}

export async function loadAll() {
    commands.clear();
    files.clear();
    for (const file of walk(config.paths.plugins)) await loadFile(file);
    log.success("plugins", `${getPlugins().length} plugin dan ${commands.size} perintah dimuat.`);
}

export function watchPlugins() {
    if (!config.plugins.watch) return null;
    const timers = new Map();
    try {
        return fs.watch(config.paths.plugins, { recursive: true }, (event, filename) => {
            if (!filename?.endsWith(".js")) return;
            const full = path.join(config.paths.plugins, filename);
            if (path.basename(full).startsWith("_")) return;
            clearTimeout(timers.get(full));
            timers.set(
                full,
                setTimeout(async () => {
                    if (fs.existsSync(full)) {
                        await loadFile(full);
                        log.info("plugins", `Dimuat semula: ${filename}`);
                    } else {
                        unloadFile(full);
                        log.info("plugins", `Dibuang: ${filename}`);
                    }
                }, 300)
            );
        });
    } catch (error) {
        log.warn("plugins", "Pemantauan plugin tidak disokong pada sistem ini.", error.message);
        return null;
    }
}

export const findCommand = name => commands.get(String(name).toLowerCase());

export const getPlugins = () => [...new Set([...files.values()].flat())];

export const getBeforeHooks = () => getPlugins().filter(plugin => plugin.before);

export function getCategories() {
    const groups = new Map();
    for (const plugin of getPlugins()) {
        if (!plugin.exec || plugin.hidden) continue;
        if (!groups.has(plugin.category)) groups.set(plugin.category, []);
        groups.get(plugin.category).push(plugin);
    }
    const order = config.menu.categoryOrder;
    return new Map(
        [...groups.entries()].sort(([a], [b]) => {
            const ia = order.indexOf(a) === -1 ? 99 : order.indexOf(a);
            const ib = order.indexOf(b) === -1 ? 99 : order.indexOf(b);
            return ia - ib || a.localeCompare(b);
        })
    );
}
