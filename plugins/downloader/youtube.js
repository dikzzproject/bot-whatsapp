const formatted = num =>
    new Intl.NumberFormat("ms", {
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 1
    })
        .format(num)
        .toLowerCase();

export default [
    {
        command: [
            "ytmp3",
            "ytaudio",
            "ytmp3dl",
            "yta",
            "ytmp4",
            "ytvideo",
            "ytmp4dl",
            "ytv"
        ],
        tags: ["downloader"],
        help: ["ytmp3 <url>", "ytmp4 <url>"],
        limit: 3,

        async run(m, { conn, text, prefix, command }) {
            if (!text) {
                return m.reply(
                    `Contoh: ${prefix + command} https://youtu.be/xxxxxxxxxxx`
                );
            }

            if (!text.includes("youtube.com") && !text.includes("youtu.be")) {
                return m.reply("✳️ Pautan YouTube tidak sah");
            }

            const isVideo = ["ytmp4", "ytvideo", "ytmp4dl", "ytv"].includes(
                command
            );

            await conn.sendMessage(m.chat, {
                react: { text: "🔍", key: m.key }
            });

            try {
                if (isVideo) {
                    const ytData = await ytdl.ytmp4(text);
                    const videoUrl = ytData?.download || ytData?.url;

                    if (!ytData || !videoUrl) {
                        await conn.sendMessage(m.chat, {
                            react: { text: "❌", key: m.key }
                        });
                        return m.reply("❌ Gagal memuat turun video YouTube");
                    }

                    const title = ytData.title || "YouTube Video";

                    await conn.sendMessage(m.chat, {
                        react: { text: "⏬", key: m.key }
                    });

                    const videoRes = await axios.get(videoUrl, {
                        responseType: "arraybuffer",
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        },
                        timeout: 60000
                    });

                    const videoBuffer = Buffer.from(videoRes.data);

                    const caption =
                        `✅ *YouTube MP4 Downloader*\n\n` +
                        `🎬 *Title:* ${title}\n` +
                        `📌 *Note:* Video successfully downloaded\n` +
                        `🎵 Want audio only? Type *${prefix}ytmp3 ${text}*`;

                    await conn.sendMessage(
                        m.chat,
                        {
                            video: videoBuffer,
                            caption: caption,
                            fileName: `${title}.mp4`,
                            mimetype: "video/mp4"
                        },
                        { quoted: m }
                    );
                } else {
                    const ytData = await ytdl.ytmp3(text);
                    const audioUrl = ytData?.download || ytData?.url;

                    if (!ytData || !audioUrl) {
                        await conn.sendMessage(m.chat, {
                            react: { text: "❌", key: m.key }
                        });
                        return m.reply("❌ Gagal memuat turun audio YouTube");
                    }

                    const title = ytData.title || "YouTube Audio";
                    const duration = ytData.duration || 0;

                    const durasiMenit = Math.floor(duration / 60);
                    const durasiDetik = duration % 60;
                    const durasiStr = `${durasiMenit}:${durasiDetik.toString().padStart(2, "0")}`;

                    await conn.sendMessage(m.chat, {
                        react: { text: "⏬", key: m.key }
                    });

                    const audioRes = await axios.get(audioUrl, {
                        responseType: "arraybuffer",
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        }
                    });

                    const audioBuffer = Buffer.from(audioRes.data);

                    const caption =
                        `✅ *YouTube MP3 Downloader*\n\n` +
                        `🎵 *Title:* ${title}\n` +
                        `⏱️ *Duration:* ${durasiStr}\n` +
                        `📦 *Size:* ${(audioBuffer.length / (1024 * 1024)).toFixed(2)} MB\n\n` +
                        `📌 *Note:* Audio successfully downloaded`;

                    await conn.sendMessage(
                        m.chat,
                        {
                            audio: audioBuffer,
                            mimetype: "audio/mpeg",
                            fileName: `${title}.mp3`,
                            caption: caption,
                            contextInfo: {
                                mentionedJid: [m.sender],
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterName: global.nameChannel,
                                    newsletterJid: global.newsletter
                                }
                            }
                        },
                        { quoted: m }
                    );
                }

                await conn.sendMessage(m.chat, {
                    react: { text: "✅", key: m.key }
                });
            } catch (error) {
                console.error("Error:", error);

                let errorMsg = "❌ An error occurred: " + error.message;
                if (error.code === "ECONNABORTED") {
                    errorMsg = "❌ Timeout: Video file is too large";
                } else if (error.response?.status === 404) {
                    errorMsg = "❌ Video URL not found";
                }

                await conn.sendMessage(m.chat, {
                    react: { text: "❌", key: m.key }
                });

                return m.reply(errorMsg);
            }
        }
    },
    {

        command: ["yt", "play"],
        tags: ["search", "downloader"],
        help: ["play <url/keywords>", "yt <url/keywords>"],
        limit: true,

        /**
         * Main execution logic
         * @param {Object} m - The incoming message object
         * @param {Object} context - Bot utilities provided by your framework
         */
        async run(m, { conn, args, customPrefix, command }) {
            const query = args.join(" ").trim();

            if (!query) {
                return await m.reply(
                    `❌ Sila berikan pautan YouTube atau kata kunci carian.\nContoh: *${customPrefix + command} coldplay yellow*`
                );
            }

            await m.react("⌛");

            try {
                const ytUrlRegex = /(youtube\.com|youtu\.be)/;
                let video;

                if (ytUrlRegex.test(query)) {
                    const videoIdMatch = query.match(
                        /(?:v=|youtu\.be\/)([\w-]{11})/
                    );
                    if (videoIdMatch) {
                        const res = await yts({ videoId: videoIdMatch[1] });
                        video = res;
                    } else {
                        const res = await yts(query);
                        video = res.videos?.[0];
                    }
                } else {
                    const res = await yts(query);
                    if (!res.videos || !res.videos.length) {
                        return await m.reply(
                            `❌ Tiada hasil carian ditemui untuk: *${query}*`
                        );
                    }
                    video = res.videos[0];
                }

                if (!video) {
                    return await m.reply(
                        "❌ Tidak dapat mendapatkan metadata video."
                    );
                }

                await sendButton(conn)
                    .header(
                        `🎬 ${video.title}`,
                        `Uploaded: ${video.ago || `"-"`}`
                    )
                    .thumbnail(video.thumbnail)
                    .text(
                        `
*👤 Channel:* ${video.author.name || "-"}
*⏱️ Duration*: ${video.timestamp || "-"} / ${video.seconds || "-"}
*👀 Views*: ${formatted(video.views) || "-"}
*📎 Link*: ${video.url || "-"}

Select your preferred download format below:
`.trim()
                    )
                    .footer("YT Downloader")
                    .button({
                        type: "reply",
                        text: "🎵 Audio",
                        id: `.ytmp3 ${video.url}`
                    })
                    .button({
                        type: "reply",
                        text: "🎬 Video",
                        id: `.ytmp4 ${video.url}`
                    })
                    .quoted(m)
                    .send(m.chat);
            } catch (error) {
                console.error("Error in yt.js plugin:", error);
                await m.reply(`❌ Carian gagal: ${error.message}`);
            }
        }
    }
];
