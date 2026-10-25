import makeWaSocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import NodeCache from "node-cache";
import cache from './lib/cache.js';
import {loadPlugins, handle} from './events/handle.js'

const { version } = await fetchLatestBaileysVersion();
const logger = pino({ level: "fatal" }).child({ level: "silent" });
const msgRetryCounterCache = new NodeCache({
    stdTTL: 600,
    checkperiod: 120
});

process.on('SIGINT', () => {
  cache.clear();
  console.log(`\n\nCache Cleared!`);
  process.exit(0);
});

function bot(nomer) {
  loadPlugins();
    const session = `./session/${nomer}`;
    useMultiFileAuthState(session)
        .then(({ state, saveCreds }) => {
            const sock = (makeWaSocket.default || makeWaSocket)({
                logger,
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                syncFullHistory: false,
                msgRetryCounterCache
            });

            sock.ev.on(
                "connection.update",
                ({ connection, lastDisconnect }) => {
                    if (connection === "close") {
                        if (
                            lastDisconnect?.error?.output?.statusCode !==
                            DisconnectReason.loggedOut
                        ) {
                            bot(nomer);
                        } else {
                            if (fs.existsSync(session)) {
                                fs.rmSync(session, {
                                    recursive: true,
                                    force: true
                                });
                            }
                        }
                    }

                    if (connection === "open") {
                        console.log(`session-+${nomer} is active now!`);
                    }
                }
            );

            if (!sock.authState.creds.registered) {
                setTimeout(() => {
                    sock.requestPairingCode(nomer)
                        .then(kode => {
                            console.log(
                                `Pairing Code: ${kode.match(/.{1,4}/g, "").join("–")}`
                            );
                        })
                        .catch(err => console.log(err));
                }, 3000);
            }

            sock.ev.on("creds.update", saveCreds);
          
            sock.ev.on("messages.upsert", async ({ messages, type }) => {
                if (type !== "notify") return;

                const msg = messages[0];
                if (!msg.message) return;
                if (msg.key.remoteJid === "status@broadcast") return;
              
                handle(sock, messages);
            });
        })
        .catch(err => console.log(err));
}

bot(628XXXX);
// nomor