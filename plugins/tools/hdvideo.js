const HDV_PRESETS = {
    2: { label: "2× HD Video", emoji: "🔹", desc: "Peningkatan ringan 2x", timeEst: "~15 saat", crf: 20, preset: "fast", denoise: "1.5:1.5:0:0", unsharp: "5:5:0.8:3:3:0.4", brightness: 0.02, contrast: 1.05, saturation: 1.1 },
    4: { label: "4× Standard HD", emoji: "🔷", desc: "Video HD standard yang jelas", timeEst: "~30 saat", crf: 18, preset: "medium", denoise: "2:2:0:0", unsharp: "5:5:1.0:3:3:0.5", brightness: 0.03, contrast: 1.08, saturation: 1.15 },
    6: { label: "6× Super Clear", emoji: "🔵", desc: "Video jelas dan terperinci", timeEst: "~1 minit", crf: 17, preset: "medium", denoise: "2.5:2.5:0:0", unsharp: "5:5:1.2:3:3:0.6", brightness: 0.04, contrast: 1.1, saturation: 1.18 },
    8: { label: "8× Super HD", emoji: "🟣", desc: "Resolusi tinggi Super HD", timeEst: "~2 minit", crf: 16, preset: "medium", denoise: "3:3:0:0", unsharp: "7:7:1.3:3:3:0.6", brightness: 0.05, contrast: 1.12, saturation: 1.2 }
};

const MAX_SIDE = 1920;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const UNBLUR = {
    api: "https://api.unblurimage.ai",
    cdn: "https://cdn.unblurimage.ai",
    timeoutMs: 600000,
    requestTimeoutMs: 60000
};

export default [
    {
        command: ["hdvid", "hdvideo"],
        help: ["hdvid", "hdvideo"],
        tags: ["tools", "ai"],
        description: "Tingkatkan kualiti video menggunakan AI (2K)",
        usage: "{prefix}hdvid (balas atau hantar video)",
        example: "{prefix}hdvid",
        limit: 1,

        run: async (m, ctx) => {
            const source = m.media?.kind === "video" ? m.media : m.quoted?.media?.kind === "video" ? m.quoted.media : null;
            if (!source) return m.reply(`${needVideoText(ctx, "hdvid")}\nContoh: ${ctx.usedPrefix}hdvid`);

            if (Number(source.node.fileLength ?? 0) > MAX_INPUT_BYTES) {
                throw new UserError("Video terlalu besar. Had maksimum 64 MB.");
            }

            await m.reply("⏳ *Memproses HD Video AI...*\n_Ini boleh ambil masa beberapa minit._");

            const buffer = await downloadMedia(source, ctx.conn);
            if (!buffer?.length) throw new UserError("Gagal memuat turun video. Cuba hantar semula.");

            let output;
            try {
                output = await aiUpscale(buffer);
            } catch (error) {
                log.error("hdvid", "Penambahbaikan AI gagal", error);
                throw new UserError(
                    `❌ HD Video AI gagal: ${error.message}\n\nCuba HD tempatan: ${ctx.usedPrefix}hdvid2 <faktor>\nContoh: ${ctx.usedPrefix}hdvid2 4`
                );
            }

            return ctx.conn.sendMessage(m.chat, { video: output, mimetype: "video/mp4", caption: "✨ *HD Video AI siap*" }, { quoted: m });
        }
    },
    {
        command: ["hdvid2", "hdvideo2"],
        help: ["hdvid2 [faktor]", "hdvideo2 [faktor]"],
        tags: ["tools", "ai"],
        description: "Tingkatkan kualiti video secara tempatan (presets, ffmpeg)",
        usage: "{prefix}hdvid2 [faktor] (balas atau hantar video)",
        example: "{prefix}hdvid2 4",
        limit: 1,

        run: async (m, ctx) => {
            const source = m.media?.kind === "video" ? m.media : m.quoted?.media?.kind === "video" ? m.quoted.media : null;
            if (!source) {
                const list = Object.entries(HDV_PRESETS)
                    .map(([factor, preset]) => `• ${factor}x : ${preset.label} (${preset.timeEst})`)
                    .join("\n");
                return m.reply(`${needVideoText(ctx, "hdvid2 <faktor>")}\nContoh: ${ctx.usedPrefix}hdvid2 4\n\n*Faktor tersedia:*\n${list}`);
            }

            const factor = ctx.args[0] ? Number(ctx.args[0]) : 2;
            const preset = HDV_PRESETS[factor];
            if (!preset) {
                throw new UserError(`❌ Faktor *${ctx.args[0]}* tidak sah.\nPilihan: ${Object.keys(HDV_PRESETS).join(", ")}`);
            }

            if (Number(source.node.fileLength ?? 0) > MAX_INPUT_BYTES) {
                throw new UserError("Video terlalu besar. Had maksimum 64 MB.");
            }

            await m.reply(`⏳ *Memproses ${preset.label}...*\n_${preset.desc} (anggaran ${preset.timeEst})_`);

            const buffer = await downloadMedia(source, ctx.conn);
            if (!buffer?.length) throw new UserError("Gagal memuat turun video. Cuba hantar semula.");

            const output = await localUpscale(buffer, factor);
            return ctx.conn.sendMessage(
                m.chat,
                { video: output, mimetype: "video/mp4", caption: `✨ *${preset.label} siap*\n${preset.emoji} Faktor: ${factor}x\n📝 ${preset.desc}` },
                { quoted: m }
            );
        }
    }
];