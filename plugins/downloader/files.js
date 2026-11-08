const MAX_LIST = 8;

const mimeOf = name => {
    const ext = path.extname(name).toLowerCase();
    return (
        { ".zip": "application/zip", ".pdf": "application/pdf", ".apk": "application/vnd.android.package-archive", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".png": "image/png", ".jpg": "image/jpeg", ".txt": "text/plain" }[ext] ??
        "application/octet-stream"
    );
};

export default [
    {
        command: ["mediafire", "mf"],
        help: ["mediafire <pautan>"],
        tags: ["downloader"],
        needText: true,
        limit: 1,
        loading: true,
        exec: async (m, { conn, args }) => {
            const url = args[0];
            if (!/mediafire\.com/i.test(url ?? "")) throw new UserError("Pautan MediaFire tidak sah.");
            const html = await axios.get(url, { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } }).then(response => response.data);
            const link = String(html).match(/href="(https:\/\/download[^"]+)"/i)?.[1];
            if (!link) throw new UserError("Pautan muat turun tidak ditemui. Fail mungkin dipadam.");
            const fileName = decodeURIComponent(link.split("/").pop().split("?")[0]) || "mediafire-file";
            return conn.sendMessage(m.chat, { document: { url: link }, fileName, mimetype: mimeOf(fileName) }, { quoted: m });
        }
    },
    {
        command: ["gdrive", "googledrive"],
        help: ["gdrive <pautan>"],
        tags: ["downloader"],
        needText: true,
        limit: 1,
        loading: true,
        exec: async (m, { conn, args }) => {
            const id = args[0]?.match(/\/d\/([\w-]+)|[?&]id=([\w-]+)/)?.slice(1).find(Boolean);
            if (!id) throw new UserError("Pautan Google Drive tidak sah.");
            const url = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
            return conn.sendMessage(m.chat, { document: { url }, fileName: `gdrive-${id}`, mimetype: "application/octet-stream" }, { quoted: m });
        }
    },
    {
        command: ["pixeldrain", "pd"],
        help: ["pixeldrain <pautan>"],
        tags: ["downloader"],
        needText: true,
        limit: 1,
        loading: true,
        exec: async (m, { conn, args }) => {
            const id = args[0]?.match(/pixeldrain\.com\/u\/(\w+)/i)?.[1];
            if (!id) throw new UserError("Pautan Pixeldrain tidak sah.");
            const info = await fetchJson(`https://pixeldrain.com/api/file/${id}/info`);
            return conn.sendMessage(
                m.chat,
                { document: { url: `https://pixeldrain.com/api/file/${id}` }, fileName: info.name, mimetype: info.mime_type || mimeOf(info.name) },
                { quoted: m }
            );
        }
    },
    {
        command: ["gitclone", "gitzip"],
        help: ["gitclone <pautan repo GitHub>"],
        tags: ["downloader"],
        needText: true,
        limit: 1,
        loading: true,
        exec: async (m, { conn, args }) => {
            const match = args[0]?.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
            if (!match) throw new UserError("Pautan repositori GitHub tidak sah.");
            const repo = match[2].replace(/\.git$/, "");
            const zip = await fetchBuffer(`https://api.github.com/repos/${match[1]}/${repo}/zipball`).catch(() => null);
            if (!zip) throw new UserError("Repositori tidak dijumpai atau terlalu besar.");
            return conn.sendMessage(m.chat, { document: zip, fileName: `${repo}.zip`, mimetype: "application/zip" }, { quoted: m });
        }
    },
    {
        command: ["ytsearch", "yts"],
        help: ["ytsearch <kata kunci>"],
        tags: ["search", "downloader"],
        needText: true,
        loading: true,
        exec: async (m, { text, usedPrefix }) => {
            if (!yts) throw new UserError("Pakej yt-search belum dipasang.");
            const result = await yts(text);
            const videos = (result.videos ?? []).slice(0, MAX_LIST);
            if (!videos.length) throw new UserError("Tiada video dijumpai.");
            const lines = videos.map(
                (video, i) => `${i + 1}. *${shorten(video.title, 70)}*\n   ${video.author?.name ?? "-"} • ${video.timestamp} • ${video.views ? formatNumber(video.views) : 0} tontonan\n   ${video.url}`
            );
            return m.reply(`▶️ *YouTube: ${text}*\n\n${lines.join("\n\n")}\n\nMuat turun: ${usedPrefix}ytmp3 <pautan> atau ${usedPrefix}ytmp4 <pautan>`);
        }
    }
];
