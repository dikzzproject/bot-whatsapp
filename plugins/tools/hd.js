const HD_PRESETS = {
    2: { label: "2x HD", emoji: "🔹", desc: "2× resolusi lebih tinggi", timeEst: "~3 saat" },
    4: { label: "4x HD", emoji: "🔷", desc: "4× resolusi lebih tinggi", timeEst: "~5 saat" },
    6: { label: "6x HD", emoji: "🔵", desc: "6× resolusi lebih tinggi", timeEst: "~10 saat" },
    8: { label: "8x HD", emoji: "🟣", desc: "8× resolusi lebih tinggi", timeEst: "~15 saat" },
    10: { label: "10x HD", emoji: "🟠", desc: "10× resolusi lebih tinggi", timeEst: "~20 saat" },
    12: { label: "12x HD", emoji: "🔴", desc: "12× resolusi lebih tinggi", timeEst: "~30 saat" },
    16: { label: "16x HD", emoji: "🟤", desc: "16× resolusi lebih tinggi", timeEst: "~45 saat" },
    18: { label: "18x Ultra", emoji: "⚫", desc: "18× resolusi ULTRA", timeEst: "~60 saat" }
};

const MAX_OUTPUT_PX = 16000;
const PHOTIU_BASE = "https://www.photiu.ai";
const PHOTIU_TIMEOUT_MS = 120000;

const PHOTIU_HEADERS = {
    Origin: PHOTIU_BASE,
    Referer: `${PHOTIU_BASE}/id/image-upscaler`,
    Accept: "*/*",
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36",
    "X-Requested-With": "XMLHttpRequest"
};

const WRAPPERS = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
    "editedMessage"
];

function needImageText(ctx, command, example) {
    const prefix = ctx?.usedPrefix ?? ".";
    return `🖼️ *HD ENHANCER*\n\nBalas atau hantar gambar dengan perintah:\n👉 ${prefix}${command}\n\nContoh: ${prefix}${example}`;
}

function unwrap(message) {
    let current = message ?? null;
    for (let depth = 0; depth < 8 && current; depth++) {
        const wrapper = WRAPPERS.find(name => current[name]?.message);
        if (!wrapper) break;
        current = current[wrapper].message;
    }
    return current;
}

function quotedMessageOf(quoted) {
    if (quoted.message) return quoted.message;
    if (quoted.type && quoted.msg) return { [quoted.type]: quoted.msg };
    return null;
}

function findImage(message, key) {
    const node = unwrap(message)?.imageMessage;
    return node ? { key, message: { imageMessage: node } } : null;
}

function findImageSource(m) {
    return findImage(m.message, m.key) ?? (m.quoted ? findImage(quotedMessageOf(m.quoted), m.quoted.key) : null);
}

async function photiuUpscale(buffer) {
    const page = await fetch(`${PHOTIU_BASE}/id/image-upscaler`, {
        headers: PHOTIU_HEADERS,
        signal: AbortSignal.timeout(PHOTIU_TIMEOUT_MS)
    });
    const cookie = page.headers
        .getSetCookie()
        .map(item => item.split(";")[0])
        .join("; ");

    const form = new FormData();
    form.append("upfile", new Blob([buffer], { type: "image/jpeg" }), "input.jpg");
    form.append("factor", "2");

    const response = await fetch(`${PHOTIU_BASE}/api/upscale`, {
        method: "POST",
        headers: { ...PHOTIU_HEADERS, ...(cookie ? { Cookie: cookie } : {}) },
        body: form,
        signal: AbortSignal.timeout(PHOTIU_TIMEOUT_MS)
    });

    if (!response.ok) throw new Error(`Photiu.ai membalas ralat ${response.status}`);

    const output = Buffer.from(await response.arrayBuffer());
    if (!output.length) throw new Error("Photiu.ai tidak menghantar gambar.");
    return output;
}

function buildFilter(factor) {
    return [
        "hqdn3d=1.5:1.5:0:0",
        `scale=min(iw*${factor}\\,${MAX_OUTPUT_PX}):min(ih*${factor}\\,${MAX_OUTPUT_PX}):force_original_aspect_ratio=decrease:flags=lanczos+accurate_rnd+full_chroma_int`,
        "unsharp=lx=5:ly=5:la=1.0:cx=3:cy=3:ca=0.4",
        "eq=saturation=1.05:contrast=1.02:gamma=0.99"
    ].join(",");
}

const upscaleLocal = (buffer, factor) =>
    ffmpeg.runFfmpeg(buffer, {
        inputExt: "img",
        outputExt: "jpg",
        args: ["-vf", buildFilter(factor), "-frames:v", "1", "-q:v", "2"]
    });


export default [
    {
        command: ["hd", "hdplus"],
        help: ["hd"],
        tags: ["tools", "ai"],
        description: "Tingkatkan resolusi gambar menggunakan Photiu.ai (2x)",
        usage: "{prefix}hd (balas atau hantar gambar)",
        example: "{prefix}hd",
        limit: 1,

        run: async (m, ctx) => {
            const source = findImageSource(m);
            if (!source) return m.reply(needImageText(ctx, "hd", "hd"));

            await m.react("⌛");

            const buffer = await downloadMedia(source, ctx.conn);
            if (!buffer?.length) throw new UserError("Gagal memuat turun gambar. Cuba hantar semula.");

            let image;
            try {
                image = await photiuUpscale(buffer);
            } catch (error) {
                log.error("hd", "Photiu.ai gagal", error);
                throw new UserError(
                    `❌ HD AI gagal: ${error.message}\n\nCuba HD tempatan: ${ctx?.usedPrefix ?? "."}hd2 <faktor>\nContoh: ${ctx?.usedPrefix ?? "."}hd2 4`
                );
            }

            return ctx.conn.sendMessage(
                m.chat,
                { image, caption: "✨ *HD AI Done*" },
                { quoted: m }
            );
        }
    },
    {
        command: ["hd2"],
        help: ["hd2 [faktor]"],
        tags: ["tools", "ai"],
        description: "Tingkatkan resolusi gambar secara tempatan (HD presets, guna ffmpeg)",
        usage: "{prefix}hd2 [faktor] (balas atau hantar gambar)",
        example: "{prefix}hd2 4",
        limit: 1,

        run: async (m, ctx) => {
            const source = findImageSource(m);

            if (!source) {
                const list = Object.entries(HD_PRESETS)
                    .map(([factor, preset]) => `• ${factor}x : ${preset.label} (${preset.timeEst})`)
                    .join("\n");
                return m.reply(
                    `${needImageText(ctx, "hd2 <faktor>", "hd2 4")}\n\n*Faktor tersedia:*\n${list}`
                );
            }

            const factor = ctx.args[0] ? Number(ctx.args[0]) : 2;
            const preset = HD_PRESETS[factor];
            if (!preset) {
                throw new UserError(`❌ Faktor *${ctx.args[0]}* tidak sah.\nPilihan: ${Object.keys(HD_PRESETS).join(", ")}`);
            }

            await m.reply(`⏳ *Memproses HD ${preset.label}...*\n_${preset.desc} (anggaran ${preset.timeEst})_`);

            const buffer = await downloadMedia(source, ctx.conn);
            if (!buffer?.length) throw new UserError("Gagal memuat turun gambar. Cuba hantar semula.");

            const image = await upscaleLocal(buffer, factor);
            return ctx.conn.sendMessage(
                m.chat,
                {
                    image,
                    caption: `✨ *HD ${preset.label} siap*\n${preset.emoji} Faktor: ${factor}x\n📝 ${preset.desc}`
                },
                { quoted: m }
            );
        }
    }
];
