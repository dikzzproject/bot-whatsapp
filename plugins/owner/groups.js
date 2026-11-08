const getOfficial = () => registry.official;
const { OWNER_ONLY, formatDate, parseDays, rentals } = ownerKit;

const DAY_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

async function sweepRentals() {
    const sock = getOfficial();
    if (!sock?.user) return;
    for (const [jid, info] of Object.entries(rentals(db))) {
        if (!info.until || info.until > Date.now()) continue;
        try {
            await sock.sendMessage(jid, { text: "⌛ Tempoh sewa bot telah tamat. Bot akan keluar daripada kumpulan ini." });
            await sock.groupLeave(jid);
        } catch {
            continue;
        }
        delete rentals(db)[jid];
    }
}

if (globalThis.__rentalTimer) clearInterval(globalThis.__rentalTimer);
globalThis.__rentalTimer = setInterval(() => sweepRentals().catch(() => null), SWEEP_INTERVAL_MS);
globalThis.__rentalTimer.unref?.();

const findGroupJid = (m, args) => args.find(arg => arg.endsWith("@g.us")) ?? (m.isGroup ? m.chat : "");

export default [
    {
        ...OWNER_ONLY,
        command: ["listgc", "listgroup"],
        help: ["listgc"],
        exec: async (m, { sock }) => {
            const groups = Object.values(await sock.groupFetchAllParticipating());
            if (!groups.length) return m.reply("Bot tidak berada dalam mana-mana kumpulan.");
            groups.sort((a, b) => String(a.subject).localeCompare(String(b.subject)));
            const lines = groups.map((group, i) => {
                const rent = rentals(db)[group.id];
                return `${i + 1}. *${group.subject}*\n   ${group.id}\n   ${group.participants.length} ahli${rent ? ` • sewa: ${formatDate(rent.until)}` : ""}`;
            });
            return m.reply(`👥 *Senarai Kumpulan* (${groups.length})\n\n${lines.join("\n\n")}`);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["outgc", "leavegc"],
        help: ["outgc [jid]"],
        exec: async (m, { sock, args }) => {
            const jid = findGroupJid(m, args);
            if (!jid) return m.reply("Guna dalam kumpulan atau nyatakan ID kumpulan (@g.us).");
            await sock.sendMessage(jid, { text: "👋 Bot keluar daripada kumpulan ini atas arahan owner." }).catch(() => null);
            await sock.groupLeave(jid);
            delete rentals(db)[jid];
            if (jid !== m.chat) return m.reply(`✅ Bot keluar dari ${jid}`);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["addsewa"],
        help: ["addsewa [jid] <days>"],
        exec: (m, { args, prefix }) => {
            const jid = findGroupJid(m, args);
            const days = parseDays(args.filter(arg => arg !== jid).pop());
            if (!jid || days === null) {
                return m.reply(`Guna: ${prefix}addsewa [jid] <hari>\nContoh: ${prefix}addsewa 30\nPermanen: ${prefix}addsewa perm`);
            }
            const current = rentals(db)[jid];
            const base = current?.until > Date.now() ? current.until : Date.now();
            const until = days === 0 ? 0 : base + days * DAY_MS;
            rentals(db)[jid] = { until, by: m.number, at: Date.now() };
            return m.reply(`✅ Sewa ditambah untuk ${jid}\nTamat: ${formatDate(until)}`);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["delsewa"],
        help: ["delsewa [jid]"],
        exec: (m, { args }) => {
            const jid = findGroupJid(m, args);
            if (!jid || !rentals(db)[jid]) return m.reply("Sewa tidak dijumpai untuk kumpulan itu.");
            delete rentals(db)[jid];
            return m.reply(`✅ Sewa dipadam untuk ${jid}`);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["listsewa"],
        help: ["listsewa"],
        exec: m => {
            const rows = Object.entries(rentals(db));
            if (!rows.length) return m.reply("Tiada kumpulan yang disewa.");
            const lines = rows.map(([jid, info], i) => `${i + 1}. ${db.groups.find(jid)?.name || jid}\n   ${jid}\n   Tamat: ${formatDate(info.until)}`);
            return m.reply(`📋 *Senarai Sewa* (${rows.length})\n\n${lines.join("\n\n")}`);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["idgc"],
        help: ["idgc", "idgc <pautan kumpulan>"],
        exec: async (m, { sock, args }) => {
            const code = args[0]?.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)?.[1];
            if (code) {
                const info = await sock.groupGetInviteInfo(code);
                return m.reply(`👥 *${info.subject}*\nID: ${info.id}\nAhli: ${info.size}`);
            }
            if (!m.isGroup) return m.reply("Guna dalam kumpulan atau sertakan pautan kumpulan.");
            return m.reply(`🆔 ${m.chat}`);
        }
    },
    {
        ...OWNER_ONLY,
        command: ["cekid", "id"],
        help: ["cekid"],
        exec: (m, { sock }) => {
            const lines = [
                `Chat    : ${m.chat}`,
                `Pengirim: ${m.sender}`,
                `ID DB   : ${m.userId}`,
                m.senderAlt ? `Alt     : ${m.senderAlt}` : "",
                m.quoted ? `Dipetik : ${m.quoted.sender}` : "",
                m.mentionedJid.length ? `Tag     : ${m.mentionedJid.join(", ")}` : "",
                `Bot     : ${sock.botJid}`,
                sock.botLid ? `Bot LID : ${sock.botLid}` : ""
            ];
            return m.reply(`🆔 *ID*\n${lines.filter(Boolean).join("\n")}`);
        }
    }
];
