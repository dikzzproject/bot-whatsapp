import QRCode from "qrcode";
import config from "#config/global.js";
import { formatDuration } from "#lib/utils.js";
import {
    canStart,
    countActive,
    createQrId,
    findByOwner,
    getSession,
    listSessions,
    startSession,
    stopSession
} from "./manager.js";

const MAX_QR_SENT = 3;

export async function startFromMessage(m, ctx, { method, number }) {
    const owner = m.number;
    const check = canStart({ owner, number, isOwner: ctx.isOwner, isPremium: ctx.isPremium });
    if (!check.ok) return m.reply(check.message);

    const id = method === "qr" ? createQrId() : number;
    if (getSession(id)) return m.reply("Jadibot untuk nombor ini sudah aktif atau sedang diproses.");

    let qrSent = 0;
    await m.reply(
        method === "qr"
            ? "⏳ Menjana kod QR, sila tunggu sebentar..."
            : `⏳ Meminta kod pairing untuk +${number}...`
    );

    await startSession({
        id,
        method,
        owner,
        source: "whatsapp",
        hooks: {
            onPairing: code =>
                m.reply(
                    `🔑 *Kod Pairing:* ${code}\n\n1. Buka WhatsApp pada +${number}\n2. Peranti Dipautkan › Pautkan peranti\n3. Pilih "Pautkan dengan nombor telefon"\n4. Masukkan kod di atas\n\n_Kod tamat dalam ${formatDuration(config.jadibot.pairTimeoutMs)}._`
                ),
            onQr: async qr => {
                if (qrSent >= MAX_QR_SENT) return;
                qrSent++;
                const image = await QRCode.toBuffer(qr, { margin: 2, width: 400 });
                await ctx.sock.sendMessage(
                    m.chat,
                    { image, caption: `📷 Imbas kod QR ini melalui Peranti Dipautkan.\nPercubaan ${qrSent}/${MAX_QR_SENT}` },
                    { quoted: m }
                );
            },
            onError: () => m.reply("⚠️ Gagal meminta kod pairing. Pastikan nombor betul dan cuba semula."),
            onOpen: entry => m.reply(`✅ Jadibot berjaya disambung sebagai +${entry.number}.`),
            onRemoved: reason => m.reply(`ℹ️ Jadibot dihentikan: ${reason}`)
        }
    });
}

export async function stopFromMessage(m, ctx, target) {
    const owned = findByOwner(m.number);
    const id = target && target !== "me" ? target : owned[0]?.id;
    if (!id) return m.reply("Anda tiada jadibot aktif.");

    const entry = getSession(id);
    const allowed = ctx.isOwner || entry?.owner === m.number || entry?.number === m.number;
    if (!entry || !allowed) return m.reply("Jadibot tidak dijumpai atau bukan milik anda.");

    await stopSession(entry.id, { remove: true, reason: "Dihentikan oleh pemilik." });
    return m.reply("✅ Jadibot dihentikan dan peranti dinyahpautkan.");
}

export function buildListText({ onlyOwner }) {
    const rows = listSessions().filter(item => !onlyOwner || item.owner === onlyOwner);
    if (!rows.length) return "Tiada jadibot aktif.";
    const lines = rows.map(
        (item, index) =>
            `${index + 1}. ${item.number ? `+${item.number}` : item.id}\n   Status: ${item.status} • Sumber: ${item.source}`
    );
    return `🤖 *Jadibot Aktif* (${rows.length}/${config.jadibot.maxActive})\n\n${lines.join("\n")}`;
}

export const activeCount = countActive;
