import "./manager.js";
import "./accounts.js";

const MAX_QR_SENT = 3;
const NUMBER_PATTERN = /^\d{8,15}$/;
const YES = /^(ya|y|yes|ok|setuju|teruskan)$/i;
const NO = /^(tidak|no|n|batal)$/i;

const webUrl = () => {
    const web = config.jadibot.web;
    return web.publicUrl ? web.publicUrl.replace(/\/+$/, "") : `http://localhost:${web.port}`;
};

export const requesterParts = m => unique([cleanNumber(m.pn), jidUser(m.lid)]);

export function jadibotLine(item, index) {
    const number = item.number ? `+${item.number}` : item.pairNumber ? `+${item.pairNumber} (belum dipautkan)` : "belum dipautkan";
    return `${index + 1}. *${item.name || "-"}*\n   Nombor : ${number}\n   Sesi   : ${item.id}\n   Status : ${item.status}`;
}

export function listText(items, title = "Jadibot") {
    if (!items.length) return `Tiada ${title.toLowerCase()}.`;
    return `🤖 *${title}* (${items.length})\n\n${items.map(jadibotLine).join("\n\n")}\n\nPadam: .killjadibot <nama | sesi | nombor>`;
}

const ownedIds = (m, ctx) =>
    ctx.isOwner
        ? undefined
        : db.jadibot.listSessions().filter(item => item.ownerKey === m.userId || (item.owners ?? []).some(owner => requesterParts(m).includes(owner))).map(item => item.id);

export const ownedSessionIds = ownedIds;

function buildSteps(m) {
    const ownNumber = cleanNumber(m.pn);
    return [
        {
            key: "name",
            ask: "🤖 *Pendaftaran Jadibot*\n\nApakah *nama bot* anda? (3 hingga 25 aksara)",
            parse: input => (input.length < 3 || input.length > 25 ? { error: "Nama mesti 3 hingga 25 aksara." } : { value: input })
        },
        {
            key: "target",
            ask: () =>
                [
                    "📱 Nombor manakah yang mahu dijadikan bot?",
                    "",
                    ownNumber ? `• Taip *saya* untuk guna nombor anda (+${ownNumber}). Hanya anda yang menjaga bot.` : "",
                    "• Taip nombor lain (contoh *60123456789*). Anda dan nombor itu menjaga bot bersama.",
                    "• Taip *qr* untuk memautkan melalui kod QR."
                ]
                    .filter(Boolean)
                    .join("\n"),
            parse: input => {
                if (/^(saya|me|sendiri)$/i.test(input)) {
                    if (!ownNumber) return { error: "Nombor anda tidak dapat dikesan. Sila taip nombor secara manual." };
                    return { value: { method: "pairing", number: ownNumber, own: true } };
                }
                if (/^qr$/i.test(input)) return { value: { method: "qr", number: "", own: false } };
                const digits = cleanNumber(input);
                if (!NUMBER_PATTERN.test(digits)) return { error: "Nombor tidak sah. Guna format 60123456789 (tanpa +)." };
                return { value: { method: "pairing", number: digits, own: digits === ownNumber } };
            }
        },
        {
            key: "email",
            ask: `📧 Masukkan *email* anda untuk log masuk ke dashboard web (${webUrl()}) dan urus tetapan bot dari pelayar.\n\nKata laluan rawak akan dihantar ke chat ini.\nTaip *skip* jika tidak mahu akaun web.`,
            parse: input => {
                if (/^(skip|langkau)$/i.test(input)) return { value: "" };
                if (!isEmail(input)) return { error: "Format email tidak sah. Contoh: nama@gmail.com" };
                const existing = db.accounts.find(input);
                if (existing && !existing.ownerIds.includes(m.userId)) return { error: "Email ini sudah digunakan oleh pengguna lain. Guna email lain." };
                return { value: input.trim().toLowerCase() };
            }
        },
        {
            key: "confirm",
            ask: answers =>
                [
                    "📋 *Sahkan maklumat jadibot*",
                    `Nama bot : ${answers.name}`,
                    `Kaedah   : ${answers.target.method === "qr" ? "Kod QR" : `Kod pairing +${answers.target.number}`}`,
                    `Penjaga  : ${answers.target.own || answers.target.method === "qr" ? "Anda (dan nombor bot jika berbeza)" : `Anda dan +${answers.target.number}`}`,
                    `Email web: ${answers.email || "tiada"}`,
                    "",
                    "Taip *ya* untuk teruskan atau *tidak* untuk batal."
                ].join("\n"),
            parse: input => (YES.test(input) ? { value: true } : NO.test(input) ? { value: false } : { error: "Jawab *ya* atau *tidak*." })
        }
    ];
}

async function finish(answers, m, ctx) {
    if (!answers.confirm) return m.reply("❌ Pendaftaran jadibot dibatalkan.");

    const { name, target, email } = answers;
    const parts = requesterParts(m);
    let qrSent = 0;

    const prepared = email ? accounts.createWhatsAppAccount({ email, ownerId: m.userId, waNumber: cleanNumber(m.pn) }) : null;

    const info = await jadibot.createSession({
        name,
        method: target.method,
        pairNumber: target.number,
        requesterParts: parts,
        ownerKey: m.userId,
        ownerNumber: m.number,
        accountEmail: email,
        source: "whatsapp",
        isOwner: ctx.isOwner,
        isPremium: ctx.isPremium,
        hooks: {
            onPairing: code =>
                ctx.sock.sendMessage(
                    m.chat,
                    {
                        text: `🔑 *Kod Pairing:* ${code}\n\n1. Buka WhatsApp pada +${target.number}\n2. Peranti Dipautkan › Pautkan peranti\n3. Pilih "Pautkan dengan nombor telefon"\n4. Masukkan kod di atas\n\n_Kod tamat dalam ${formatDuration(config.jadibot.pairTimeoutMs)}._`
                    },
                    { quoted: m }
                ),
            onQr: async qr => {
                if (qrSent >= MAX_QR_SENT) return;
                qrSent++;
                const image = await QRCode.toBuffer(qr, { margin: 2, width: 400 });
                await ctx.sock.sendMessage(m.chat, { image, caption: `📷 Imbas kod QR ini melalui Peranti Dipautkan.\nPercubaan ${qrSent}/${MAX_QR_SENT}` }, { quoted: m });
            },
            onError: () => ctx.sock.sendMessage(m.chat, { text: "⚠️ Gagal meminta kod pairing. Pastikan nombor betul dan cuba semula." }),
            onOpen: item =>
                ctx.sock.sendMessage(m.chat, {
                    text: [
                        `✅ *${item.name}* berjaya disambung sebagai +${item.number}.`,
                        "",
                        `Sesi    : ${item.id}`,
                        `Penjaga : ${item.owners.length} nombor (anda${item.number && !parts.includes(item.number) ? " dan bot" : ""})`,
                        "",
                        "Dalam chat bot itu, taip *.setting* untuk melihat tetapan, atau urus dari dashboard web."
                    ].join("\n")
                }),
            onRemoved: reason => ctx.sock.sendMessage(m.chat, { text: `ℹ️ Jadibot dihentikan: ${reason}` })
        }
    });

    let accountText = "";
    if (prepared) {
        if (prepared.account) {
            accountText = `\n\n🌐 Dashboard: ${webUrl()}\nEmail: ${prepared.account.email}\n_Akaun ini sudah wujud. Guna kata laluan sedia ada, atau taip .webpass untuk menjana yang baharu._`;
            if (!prepared.account.ownerIds.includes(m.userId)) prepared.account.ownerIds.push(m.userId);
        } else {
            const account = await prepared.commit();
            accountText = `\n\n🌐 *Dashboard web*\nPautan : ${webUrl()}\nEmail  : ${account.email}\nKata laluan: *${prepared.password}*\n\n_Simpan kata laluan ini dan tukar selepas log masuk._`;
        }
    }

    return m.reply(`⏳ Jadibot *${info.name}* sedang diproses (sesi: ${info.id}).${accountText}`);
}

export async function startFromMessage(m, ctx) {
    const parts = requesterParts(m);
    const check = jadibot.canCreate({ ownerKey: m.userId, numbers: parts, isOwner: ctx.isOwner, isPremium: ctx.isPremium });
    if (!check.ok) return m.reply(check.message);
    return wizard.start(m, ctx, { steps: buildSteps(m), onDone: finish });
}

Object.assign(global.jadibot, { startFromMessage, listText, jadibotLine, ownedSessionIds, requesterParts, webUrl });
