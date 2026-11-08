import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXEC_KEYS = ["exec", "run", "execute", "handler", "handle", "call"];
const files = new Map();
const commands = new Map();
const regexPlugins = new Set();
const prefixedPlugins = new Set();

const flag = value => Boolean(value);
const normalizeReact = value => {
    if (value === true) return "🍂";
    if (typeof value === "string" && value.trim()) return value.trim();
    return null;
};
const safeRegex = regex => new RegExp(regex.source, regex.flags.replace(/[gy]/g, ""));
const isEmptyRegex = regex => regex.source === "(?:)";

function normalize(definition, file, index) {
    if (!definition) return null;
    const isFunction = typeof definition === "function";
    const exec = isFunction ? definition : EXEC_KEYS.map(key => definition[key]).find(fn => typeof fn === "function");
    const before = typeof definition.before === "function" ? definition.before : null;
    if (!exec && !before) return null;

    const rawCommands = toArray(definition.command ?? definition.commands ?? definition.cmd);
    const commandList = rawCommands.filter(item => typeof item === "string").map(item => item.toLowerCase());
    const commandRegex = rawCommands.filter(item => item instanceof RegExp).map(safeRegex);
    const customPrefix =
        definition.prefix === undefined
            ? null
            : toArray(definition.prefix).filter(item => typeof item === "string" || item instanceof RegExp);

    if (exec && !commandList.length && !commandRegex.length && !customPrefix?.length) {
        log.warn("plugins", `${path.relative(config.paths.root, file)} diabaikan kerana tiada "command".`);
        return null;
    }

    const tags = toArray(definition.tags ?? definition.tag).map(tag => String(tag).toLowerCase());
    if (!tags.length) tags.push(path.basename(path.dirname(file)).toLowerCase());

    const defaultHelp = commandList.length
        ? commandList
        : (customPrefix ?? []).filter(item => typeof item === "string");

    return {
        id: `${file}#${index}`,
        file,  
        name: definition.name ?? commandList[0] ?? `before:${path.basename(file, ".js")}`,
        command: commandList,
        commandRegex,
        customPrefix: customPrefix?.length ? customPrefix : null,
        help: toArray(definition.help ?? defaultHelp),
        tags,
        category: tags[0],
        description: definition.description ?? "",
        usage: definition.usage ?? "",
        example: definition.example ?? "",
        group: flag(definition.group),
        react: normalizeReact(definition.react),
        private: flag(definition.private),
        admin: flag(definition.admin),
        botAdmin: flag(definition.botAdmin),
        owner: flag(definition.owner ?? definition.developer),
        botOwner: flag(definition.botOwner),
        premium: flag(definition.premium),
        register: flag(definition.register),
        official: flag(definition.official),
        blacklist: flag(definition.blacklist),
        hidden: flag(definition.hidden),
        disabled: flag(definition.disabled),
        loading: flag(definition.loading),
        limit: Number(definition.limit) || 0,
        cooldown: Number(definition.cooldown) || 0,
        needText: definition.needText ?? false,
        media: definition.media === true ? ["any"] : toArray(definition.media),
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

function refreshGlobal() {
    global.plugins = Object.fromEntries(getPlugins().map(plugin => [plugin.id, plugin]));
}

export function unloadFile(file) {
    for (const plugin of files.get(file) ?? []) {
        for (const name of plugin.command) {
            if (commands.get(name) === plugin) commands.delete(name);
        }
        regexPlugins.delete(plugin);
        prefixedPlugins.delete(plugin);
    }
    files.delete(file);
    refreshGlobal();
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
            if (plugin.customPrefix) {
                prefixedPlugins.add(plugin);
                continue;
            }
            for (const name of plugin.command) {
                const existing = commands.get(name);
                if (existing && existing.file !== file) {
                    log.warn("plugins", `Perintah "${name}" bertindih: ${path.basename(existing.file)} dan ${path.basename(file)}.`);
                }
                commands.set(name, plugin);
            }
            if (plugin.commandRegex.length) regexPlugins.add(plugin);
        }
        files.set(file, plugins);
        refreshGlobal();
        return plugins.length;
    } catch (error) {
        log.error("plugins", `Gagal memuat ${path.relative(config.paths.root, file)}`, error);
        return 0;
    }
}

export async function loadAll() {
    commands.clear();
    regexPlugins.clear();
    prefixedPlugins.clear();
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

function matchPrefix(body, pattern) {
    if (typeof pattern === "string") {
        return body.toLowerCase().startsWith(pattern.toLowerCase()) ? body.slice(0, pattern.length) : null;
    }
    const found = safeRegex(pattern).exec(body);
    return found && found.index === 0 ? found[0] : null;
}

function splitCommand(rest) {
    const match = rest.match(/^\s*(\S*)([\s\S]*)$/);
    const text = match[2].trim();
    return { token: match[1], text, args: text ? text.split(/\s+/) : [] };
}

function testCommand(plugin, token, boundary) {
    if (plugin.command.includes(token.toLowerCase())) return { match: null };
    for (const regex of plugin.commandRegex) {
        const found = regex.exec(token);
        if (!found) continue;
        if (isEmptyRegex(regex) && boundary && token) continue;
        return { match: found };
    }
    if (!plugin.command.length && !plugin.commandRegex.length) return { match: null };
    return null;
}

export function matchPlugin(text, defaultPrefixes = config.prefix) {
    const body = String(text ?? "");
    if (!body) return null;

    for (const plugin of prefixedPlugins) {
        for (const pattern of plugin.customPrefix) {
            const used = matchPrefix(body, pattern);
            if (used === null) continue;
            const rest = body.slice(used.length);
            const boundary = typeof pattern === "string" && /\w$/.test(pattern) && /^\w/.test(rest);
            const parsed = splitCommand(rest);
            const found = testCommand(plugin, parsed.token, boundary);
            if (found) {
                return { plugin, prefix: used, command: parsed.token.toLowerCase(), text: parsed.text, args: parsed.args, match: found.match };
            }
        }
    }

    const used = [...defaultPrefixes].sort((a, b) => b.length - a.length).find(item => item && body.startsWith(item));
    if (used === undefined) return null;
    const parsed = splitCommand(body.slice(used.length));
    if (!parsed.token) return null;

    const direct = commands.get(parsed.token.toLowerCase());
    if (direct) return { plugin: direct, prefix: used, command: parsed.token.toLowerCase(), text: parsed.text, args: parsed.args, match: null };

    for (const plugin of regexPlugins) {
        const found = testCommand(plugin, parsed.token, false);
        if (found) return { plugin, prefix: used, command: parsed.token.toLowerCase(), text: parsed.text, args: parsed.args, match: found.match };
    }
    return null;
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
    return groups;
}

global.pluginLoader = { loadAll, loadFile, unloadFile, watchPlugins, getPlugins, findCommand, matchPlugin, getBeforeHooks, getCategories };
