const MESSAGE_KEYS = [
    ...new Set([...Object.keys(config.messages), ...Object.keys(config.jadibot.defaults.messages)])
];

const nonEmpty = object =>
    Object.fromEntries(Object.entries(object ?? {}).filter(([, value]) => typeof value === "string" && value.trim() !== ""));

export function getBotConfig(sock) {
    const record = sock.isJadibot ? db.jadibot.getSession(sock.jadibotId) : null;

    if (record) {
        record.settings ??= {};
        deepDefaults(record.settings, structuredClone(config.jadibot.defaults));
        record.settings.usage ??= {};
        record.owners ??= [];
        const settings = record.settings;
        return {
            isJadibot: true,
            id: sock.jadibotId,
            name: record.name || config.bot.name,
            prefix: settings.prefix.length ? settings.prefix : config.prefix,
            mode: settings.mode,
            limit: settings.limit,
            owners: record.owners,
            messages: { ...config.messages, ...nonEmpty(settings.messages) },
            rawMessages: settings.messages,
            holder: settings,
            record
        };
    }

    const official = db.settings.official;
    official.usage ??= {};
    return {
        isJadibot: false,
        id: "official",
        name: config.bot.name,
        prefix: official.prefix?.length ? official.prefix : config.prefix,
        mode: db.settings.mode,
        limit: official.limit,
        owners: official.owners,
        messages: { ...config.messages, ...nonEmpty(official.messages) },
        rawMessages: official.messages,
        holder: official,
        record: null
    };
}

export const getMessageKeys = () => MESSAGE_KEYS;

global.botConfig = { getBotConfig, getMessageKeys };
