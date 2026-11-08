import baileys, {
    Browsers,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    useMultiFileAuthState
} from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import pino from "pino";
import { ensureDir } from "#lib/utils.js";
import extendSocket from "./helpers.js";

const makeWASocket = baileys.default ?? baileys;
let cachedVersion = null;
const resolveVersion = async () => {
    if (cachedVersion) return cachedVersion;
    try {
        cachedVersion = (await fetchLatestBaileysVersion()).version;
    } catch {
        cachedVersion = null;
    }
    return cachedVersion;
}

export default async function makeSocket({
    sessionPath,
    role = "official",
    number = "",
    overrides = {}
} = {}) {
    ensureDir(sessionPath);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: config.baileys.logLevel });
    const version = await resolveVersion();

    const groupCache = new NodeCache({ stdTTL: 300, useClones: false });
    const msgRetryCounterCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
    const msgStore = new NodeCache({ stdTTL: 3600, maxKeys: 3000, useClones: false });

    const sock = makeWASocket({
        ...(version ? { version } : {}),
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: Browsers.ubuntu(config.baileys.browserName),
        msgRetryCounterCache,
        cachedGroupMetadata: async jid => groupCache.get(jid),
        getMessage: async key => msgStore.get(key.id)?.message,
        emitOwnEvents: true,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,

        defaultQueryTimeoutMs: 30000,
        retryRequestDelayMs: 250,
        shouldSyncHistoryMessage: msg => {
            return false; 
        },
        ...overrides
    });

    sock.ev.on("creds.update", saveCreds);
    extendSocket(sock, { role, number, groupCache, msgStore, sessionPath });

    return sock;
}
