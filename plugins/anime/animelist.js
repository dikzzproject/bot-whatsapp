const ANILIST_API = "https://graphql.anilist.co";
const SEARCH_LIMIT = 10;
const SYNOPSIS_MAX = null;
const RETRY_DELAY_MS = 2000;
const NETWORK_CODES = ["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "ECONNABORTED", "ENOTFOUND", "EAI_AGAIN"];
const cache = new TTLCache({ ttl: 10 * 60 * 1000, max: 200 });

const ANILIST_QUERY = `
query ($search: String, $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      siteUrl
      title { romaji english native }
      coverImage { large }
      format episodes status seasonYear averageScore genres description(asHtml: false)
    }
  }
}`;

const englishOf = anime => anime.title_english || anime.title || "-";

const japaneseOf = anime => anime.title_japanese || "-";

const genresOf = anime => (anime.genres ?? []).join(", ") || "-";

const stripHtml = text =>
    String(text ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "");

const isNetworkError = error =>
    NETWORK_CODES.includes(error.code) || /timeout|socket hang up/i.test(error.message ?? "") || error.response?.status >= 500;

function fromAniList(media) {
    return {
        url: media.siteUrl,
        title: media.title?.romaji ?? media.title?.english ?? "-",
        title_english: media.title?.english ?? null,
        title_japanese: media.title?.native ?? null,
        poster: media.coverImage?.large ?? null,
        type: media.format,
        episodes: media.episodes,
        status: media.status,
        year: media.seasonYear,
        score: media.averageScore ? media.averageScore / 10 : null,
        genres: media.genres ?? [],
        synopsis: stripHtml(media.description)
    };
}

async function requestAniList(query) {
    const data = await fetchJson(ANILIST_API, {
        method: "post",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        data: { query: ANILIST_QUERY, variables: { search: query, perPage: SEARCH_LIMIT } }
    });
    if (data?.errors?.length) throw new Error(data.errors[0].message);
    return (data?.data?.Page?.media ?? []).map(fromAniList);
}

async function searchAnime(query) {
    const key = query.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;

    let results;
    try {
        results = await requestAniList(query);
    } catch (error) {
        if (error.response?.status === 429) {
            throw new UserError("⏳ Terlalu banyak permintaan ke AniList. Cuba sebentar lagi.");
        }
        if (!isNetworkError(error)) {
            log.error("anime", "Ralat AniList", error.message);
            throw new UserError("❌ Ralat semasa mencari anime. Cuba lagi.");
        }

        log.warn("anime", `AniList tidak dapat dihubungi (${error.code ?? error.message}), cuba sekali lagi.`);
        await sleep(RETRY_DELAY_MS);
        try {
            results = await requestAniList(query);
        } catch (retryError) {
            log.error("anime", "AniList gagal selepas cubaan semula", retryError.code ?? retryError.message);
            throw new UserError("❌ Tidak dapat menghubungi AniList. Server bot mungkin tidak dapat mencapai internet. Cuba lagi nanti.");
        }
    }

    if (!results.length) throw new UserError(`Tiada anime dijumpai untuk "${query}".`);
    return cache.set(key, results);
}

const listLine = (anime, index) =>
    `${index + 1}. *${englishOf(anime)}*\n   🇯🇵 ${japaneseOf(anime)}\n   ⭐ ${anime.score ?? "-"} • ${anime.type ?? "-"} • ${anime.year ?? "-"}`;

const detailText = anime =>
    [
        `🎌 *${englishOf(anime)}*`,
        `🇯🇵 ${japaneseOf(anime)}`,
        `🔤 Tajuk asal: ${anime.title ?? "-"}`,
        "",
        `📺 Jenis   : ${anime.type ?? "-"} • ${anime.episodes ?? "?"} episod`,
        `📅 Tahun   : ${anime.year ?? "-"} • ${anime.status ?? "-"}`,
        `⭐ Skor    : ${anime.score ?? "-"} / 10`,
        `🎭 Genre   : ${genresOf(anime)}`,
        "",
        shorten((anime.synopsis ?? "Tiada sinopsis.").replace(/\s+/g, " ").trim(), SYNOPSIS_MAX),
        "",
        `🔗 ${anime.url ?? ""}`
    ].join("\n");

export default [
    {
        command: ["anime"],
        help: ["anime <judul>"],
        tags: ["internet"],
        description: "Cari anime (Inggeris, Jepun atau romaji) dan papar maklumat hasil teratas",
        usage: "{prefix}anime <judul> (Inggeris, Jepun atau romaji)",
        example: "{prefix}anime Frieren",
        needText: true,
        limit: 1,
        cooldown: 3,

        run: async (m, ctx) => {
            const results = await searchAnime(ctx.text);
            const top = results[0];
            const caption = detailText(top);

            if (top.poster) {
                try {
                    return await m.send({ image: { url: top.poster }, caption }, { quoted: m });
                } catch {
                    return m.reply(caption);
                }
            }
            return m.reply(caption);
        }
    },
    {
        command: ["animelist", "animesearch"],
        help: ["animelist <judul>"],
        tags: ["internet"],
        description: "Senaraikan hasil carian anime (sehingga 10) dalam Inggeris dan Jepun",
        usage: "{prefix}animelist <judul>",
        example: "{prefix}animelist Naruto",
        needText: true,
        limit: 1,
        cooldown: 3,

        run: async (m, ctx) => {
            const results = await searchAnime(ctx.text);
            const lines = results.map(listLine).join("\n\n");
            return m.reply(
                `📚 *Hasil carian: ${ctx.text}* (${results.length})\n\n${lines}\n\nLihat butiran: ${ctx.usedPrefix}anime <judul>`
            );
        }
    }
];
