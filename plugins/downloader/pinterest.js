const API = "https://api.siputzx.my.id/api/s/pinterest";
const MAX_ITEMS = 10;
const DEFAULT_ITEMS = 1;
const ALBUM_CHILD_DELAY_MS = 500;
const ONE_BY_ONE_DELAY_MS = 800;

function parseQuery(args) {
    const last = args[args.length - 1];
    if (args.length > 1 && /^\d+$/.test(last)) {
        return { query: args.slice(0, -1).join(" "), count: clamp(Number(last), 1, MAX_ITEMS) };
    }
    return { query: args.join(" "), count: DEFAULT_ITEMS };
}

function extractPins(json) {
    const list = json?.data?.results || json?.data?.result || json?.results || json?.result || json?.data || [];
    return (Array.isArray(list) ? list : []).filter(pin => pin?.image_url);
}

function extractVideos(json) {
    const list = json?.data?.results || json?.data?.result || json?.results || json?.result || json?.data || [];
    return (Array.isArray(list) ? list : [])
        .map(item => ({ item, url: videoUrlOf(item) }))
        .filter(entry => entry.url);
}

function videoUrlOf(item) {
    if (!item || typeof item !== "object") return null;
    const direct = item.video_url || item.video || item.url;
    if (typeof direct === "string") return direct;
    if (direct?.url) return direct.url;

    const list = item.videos || item.media || item.formats;
    if (Array.isArray(list) && list.length) {
        const found = list.find(entry => entry?.url) ?? list[0];
        if (typeof found === "string") return found;
        return found?.url ?? null;
    }
    if (typeof list === "object" && list?.url) return list.url;
    return null;
}

const singleCaption = pin =>
    [
        "*_乂 P I N T E R E S T_*",
        `*Title*: ${pin.grid_title || "-"}`,
        `*Description*: ${shorten(pin.description || "-", 120)}`,
        `*Broadcaster*: ${pin.pinner?.full_name} / ${pin.pinner?.username || "-"}`,
        "",
        `*Link*: ${pin.pin}`
    ].join("\n");

const videoCaption = (item, query) =>
    [
        "*_乂 P I N T E R E S T_*",
        `*Query*: ${query}`,
        `*Title*: ${item.grid_title || item.title || "-"}`,
        `*Link*: ${item.pin || item.link || "-"}`
    ].join("\n");

const albumHeader = query => `*_乂 P I N T E R E S T_*\n*Query*: ${query}`;

const pinCaption = (index, total, query) => `*PINTEREST* ${index + 1}/${total} • ${query}`;

async function sendAlbum(conn, m, pins, query) {
    const album = await conn.sendMessage(
        m.chat,
        {
            album: {
                expectedImageCount: pins.length,
                expectedVideoCount: 0
            }
        },
        { quoted: m }
    );

    if (!album?.key?.id) throw new Error("Gagal mencipta album Pinterest.");

    for (const [index, pin] of pins.entries()) {
        await conn.sendMessage(m.chat, {
            image: { url: pin.image_url },
            caption: index === 0 ? albumHeader(query) : undefined,
            albumParentKey: album.key
        });

        if (index < pins.length - 1) await sleep(ALBUM_CHILD_DELAY_MS);
    }
}

async function sendOneByOne(conn, m, pins, query) {
    let sent = 0;
    for (const [index, pin] of pins.entries()) {
        try {
            await conn.sendMessage(
                m.chat,
                { image: { url: pin.image_url }, caption: pinCaption(index, pins.length, query) },
                { quoted: m }
            );
            sent++;
        } catch (error) {
            log.warn("pinterest", `Gagal hantar gambar ${index + 1}`, error.message);
        }
        if (index < pins.length - 1) await sleep(ONE_BY_ONE_DELAY_MS);
    }
    return sent;
}

const VIDEO_HEADERS = {
    Referer: "https://www.pinterest.com/",
    Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
    "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
};

async function downloadVideo(url) {
    return fetchBuffer(url, { headers: VIDEO_HEADERS, timeout: 120000 });
}

async function sendVideos(conn, m, videos, query) {
    let sent = 0;
    for (const [index, { item, url }] of videos.entries()) {
        let buffer;
        try {
            buffer = await downloadVideo(url);
        } catch (error) {
            log.warn("pinterest", `Gagal muat turun video ${index + 1} dari ${url}`, error.message);
        }

        if (buffer?.length) {
            try {
                await conn.sendMessage(
                    m.chat,
                    {
                        video: buffer,
                        mimetype: "video/mp4",
                        caption: videos.length === 1 ? videoCaption(item, query) : `*PINTEREST VIDEO* ${index + 1}/${videos.length} • ${query}`
                    },
                    { quoted: m }
                );
                sent++;
            } catch (error) {
                log.warn("pinterest", `Gagal hantar video ${index + 1}`, error.message);
            }
        }

        if (index < videos.length - 1) await sleep(ONE_BY_ONE_DELAY_MS);
    }
    return sent;
}

export default [
    {
        command: ["pinterest", "pin"],
        help: ["pinterest <kata kunci> [1-10]", "pin <kata kunci> [1-10]"],
        tags: ["downloader"],
        description: "Cari gambar Pinterest (1-10 gambar, dihantar sebagai album)",
        usage: "{prefix}pin <kata kunci> [1-10]",
        example: "{prefix}pin kucing 5",
        needText: true,
        react: "🔄",

        run: async (m, { conn, args }) => {
            const { query, count } = parseQuery(args);
            const json = await fetchJson(API, { params: { query, type: "image" } });

            const pins = extractPins(json).slice(0, count);
            if (!pins.length) throw new UserError(`Gambar Pinterest untuk "${query}" tidak dijumpai.`);

            if (pins.length === 1) {
                return conn.sendMessage(
                    m.chat,
                    { image: { url: pins[0].image_url }, caption: singleCaption(pins[0]) },
                    { quoted: m }
                );
            }

            try {
                return await sendAlbum(conn, m, pins, query);
            } catch (error) {
                log.warn("pinterest", "Album gagal, hantar satu-satu.", error.message);
            }

            const sent = await sendOneByOne(conn, m, pins, query);
            if (!sent) throw new UserError(`Gagal memuat turun gambar untuk "${query}". Cuba lagi.`);
        }
    },
    {
        command: ["pinvideo", "pinvid"],
        help: ["pinvideo <kata kunci> [1-10]", "pinvid <kata kunci> [1-10]"],
        tags: ["downloader"],
        description: "Cari video Pinterest (1-10 video)",
        usage: "{prefix}pinvideo <kata kunci> [1-10]",
        example: "{prefix}pinvideo elaina 3",
        needText: true,
        react: "🎬",

        run: async (m, { conn, args }) => {
            const { query, count } = parseQuery(args);
            const json = await fetchJson(API, { params: { query, type: "video" } });

            const videos = extractVideos(json).slice(0, count);
            if (!videos.length) {
                log.warn("pinterest", "Struktur video tidak dikenali", JSON.stringify(json).slice(0, 300));
                throw new UserError(`Video Pinterest untuk "${query}" tidak dijumpai.`);
            }

            const sent = await sendVideos(conn, m, videos, query);
            if (!sent) throw new UserError(`Gagal memuat turun video untuk "${query}". Cuba lagi.`);
        }
    }
];
