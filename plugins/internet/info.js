const WEATHER_CODES = {
    0: "Cerah",
    1: "Kebanyakan cerah",
    2: "Sebahagian berawan",
    3: "Mendung",
    45: "Berkabus",
    48: "Kabus beku",
    51: "Gerimis ringan",
    53: "Gerimis",
    55: "Gerimis lebat",
    61: "Hujan ringan",
    63: "Hujan",
    65: "Hujan lebat",
    71: "Salji ringan",
    73: "Salji",
    75: "Salji lebat",
    80: "Hujan seketika",
    81: "Hujan lebat seketika",
    82: "Hujan sangat lebat",
    95: "Ribut petir",
    96: "Ribut petir dan hujan batu",
    99: "Ribut petir lebat dan hujan batu"
};

const COIN_IDS = {
    btc: "bitcoin",
    eth: "ethereum",
    bnb: "binancecoin",
    sol: "solana",
    xrp: "ripple",
    doge: "dogecoin",
    ada: "cardano",
    ton: "the-open-network",
    usdt: "tether",
    trx: "tron",
    ltc: "litecoin"
};

const wikiSummary = async (lang, title) =>
    fetchJson(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    ).catch(() => null);

async function wikiSearch(lang, query) {
    const data = await fetchJson(`https://${lang}.wikipedia.org/w/api.php`, {
        params: {
            action: "query",
            list: "search",
            srsearch: query,
            format: "json",
            utf8: 1,
            srlimit: 1
        }
    });
    return data?.query?.search?.[0]?.title ?? null;
}

export default [
    {
        command: ["wiki", "wikipedia"],
        help: ["wiki <topik>"],
        tags: ["internet"],
        needText: true,
        loading: true,
        exec: async (m, { text }) => {
            for (const lang of ["ms", "en"]) {
                const title = await wikiSearch(lang, text).catch(() => null);
                if (!title) continue;
                const page = await wikiSummary(lang, title);
                if (!page?.extract) continue;
                const url = page.content_urls?.desktop?.page ?? "";
                const caption = `📚 *${page.title}* (${lang.toUpperCase()})\n\n${shorten(page.extract, 1200)}\n\n${url}`;
                if (page.thumbnail?.source) {
                    return m.send(
                        { image: { url: page.thumbnail.source }, caption },
                        { quoted: m }
                    );
                }
                return m.reply(caption);
            }
            throw new UserError(`Tiada hasil Wikipedia untuk "${text}".`);
        }
    },
    {
        command: ["cuaca", "weather"],
        help: ["cuaca <bandar>"],
        tags: ["internet"],
        needText: true,
        loading: true,
        exec: async (m, { text }) => {
            const geo = await fetchJson(
                "https://geocoding-api.open-meteo.com/v1/search",
                {
                    params: { name: text, count: 1, language: "ms" }
                }
            );
            const place = geo?.results?.[0];
            if (!place) throw new UserError(`Lokasi "${text}" tidak dijumpai.`);

            const data = await fetchJson(
                "https://api.open-meteo.com/v1/forecast",
                {
                    params: {
                        latitude: place.latitude,
                        longitude: place.longitude,
                        current:
                            "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
                        timezone: "auto"
                    }
                }
            );
            const now = data.current;
            return m.reply(
                [
                    `🌤️ *Cuaca ${place.name}${place.country ? `, ${place.country}` : ""}*`,
                    `Keadaan   : ${WEATHER_CODES[now.weather_code] ?? "Tidak diketahui"}`,
                    `Suhu      : ${now.temperature_2m}°C (terasa ${now.apparent_temperature}°C)`,
                    `Kelembapan: ${now.relative_humidity_2m}%`,
                    `Hujan     : ${now.precipitation} mm`,
                    `Angin     : ${now.wind_speed_10m} km/j`
                ].join("\n")
            );
        }
    },
    {
        command: ["kurs", "currency", "tukar"],
        help: ["kurs <jumlah> <dari> <ke>"],
        tags: ["internet"],
        needText: true,
        example: "{prefix}kurs 100 usd myr",
        exec: async (m, { args }) => {
            const amount = Number(args[0]);
            const from = (args[1] ?? "").toUpperCase();
            const to = (args[2] ?? "").toUpperCase();
            if (
                !Number.isFinite(amount) ||
                amount <= 0 ||
                from.length !== 3 ||
                to.length !== 3
            ) {
                throw new UserError("Guna: .kurs 100 usd myr");
            }
            const data = await fetchJson(
                `https://open.er-api.com/v6/latest/${from}`
            );
            const rate = data?.rates?.[to];
            if (!rate) throw new UserError("Kod mata wang tidak dikenali.");
            return m.reply(
                `💱 ${formatNumber(amount)} ${from} = *${(amount * rate).toLocaleString("ms-MY", { maximumFractionDigits: 2 })} ${to}*\nKadar: 1 ${from} = ${rate} ${to}`
            );
        }
    },
    {
        command: ["crypto", "kripto"],
        help: ["crypto <syiling> [mata wang]"],
        tags: ["internet"],
        needText: true,
        example: "{prefix}crypto btc myr",
        exec: async (m, { args }) => {
            const input = args[0].toLowerCase();
            const id = COIN_IDS[input] ?? input;
            const currency = (args[1] ?? "usd").toLowerCase();
            const data = await fetchJson(
                "https://api.coingecko.com/api/v3/simple/price",
                {
                    params: {
                        ids: id,
                        vs_currencies: currency,
                        include_24hr_change: true
                    }
                }
            );
            const row = data?.[id];
            if (!row || row[currency] === undefined)
                throw new UserError("Syiling atau mata wang tidak dijumpai.");
            const change = row[`${currency}_24h_change`];
            return m.reply(
                `🪙 *${id}*\nHarga: ${row[currency].toLocaleString("en-US")} ${currency.toUpperCase()}\n24j  : ${change >= 0 ? "📈" : "📉"} ${change?.toFixed(2)}%`
            );
        }
    },
    {
        command: ["ip", "iplookup"],
        help: ["ip <alamat ip/domain>"],
        tags: ["internet"],
        needText: true,
        exec: async (m, { text }) => {
            const data = await fetchJson(
                `http://ip-api.com/json/${encodeURIComponent(text)}`,
                {
                    params: {
                        fields: "status,message,country,regionName,city,isp,org,timezone,query"
                    }
                }
            );
            if (data.status !== "success")
                throw new UserError(data.message ?? "Carian gagal.");
            return m.reply(
                `🌐 *${data.query}*\nNegara  : ${data.country}\nWilayah : ${data.regionName}\nBandar  : ${data.city}\nISP     : ${data.isp}\nOrg     : ${data.org}\nZon masa: ${data.timezone}`
            );
        }
    },
    {
        command: ["github", "ghuser"],
        help: ["github <nama pengguna>"],
        tags: ["internet"],
        needText: true,
        exec: async (m, { text }) => {
            const user = await fetchJson(
                `https://api.github.com/users/${encodeURIComponent(text)}`
            ).catch(() => null);
            if (!user?.login)
                throw new UserError("Pengguna GitHub tidak dijumpai.");
            return m.send(
                {
                    image: { url: user.avatar_url },
                    caption: `🐙 *${user.name ?? user.login}* (@${user.login})\n${user.bio ?? ""}\n\nRepo: ${user.public_repos}\nPengikut: ${user.followers}\nMengikuti: ${user.following}\nLokasi: ${user.location ?? "-"}\n${user.html_url}`
                },
                { quoted: m }
            );
        }
    },
    {
        command: ["ghrepo", "repo"],
        help: ["ghrepo <kata kunci>"],
        tags: ["internet"],
        needText: true,
        exec: async (m, { text }) => {
            const data = await fetchJson(
                "https://api.github.com/search/repositories",
                { params: { q: text, per_page: 6 } }
            );
            if (!data.items?.length)
                throw new UserError("Tiada repositori dijumpai.");
            const lines = data.items.map(
                (repo, i) =>
                    `${i + 1}. *${repo.full_name}* ⭐${formatNumber(repo.stargazers_count)}\n   ${shorten(repo.description ?? "-", 90)}\n   ${repo.html_url}`
            );
            return m.reply(`🔎 *Repositori GitHub*\n\n${lines.join("\n\n")}`);
        }
    },
    {
        command: ["npm", "npmjs"],
        help: ["npm <nama pakej>"],
        tags: ["internet"],
        needText: true,
        exec: async (m, { text }) => {
            const data = await fetchJson(
                "https://registry.npmjs.org/-/v1/search",
                { params: { text, size: 5 } }
            );
            if (!data.objects?.length)
                throw new UserError("Pakej tidak dijumpai.");
            const lines = data.objects.map(
                ({ package: pkg }, i) =>
                    `${i + 1}. *${pkg.name}* v${pkg.version}\n   ${shorten(pkg.description ?? "-", 90)}\n   ${pkg.links?.npm ?? ""}`
            );
            return m.reply(`📦 *Pakej npm*\n\n${lines.join("\n\n")}`);
        }
    },
    {
        command: ["solat", "waktusolat"],
        help: ["solat <negara/negeri>"],
        tags: ["internet"],
        needText: true,
        loading: true,
        exec: async (m, { text }) => {
            const query = text.trim();
            if (!query) {
                throw new UserError(
                    "Masukkan nama negara atau negeri.\nContoh: .solat Malaysia"
                );
            }
            const getTimings = async address => {
                const result = await fetchJson(
                    "https://api.aladhan.com/v1/timingsByAddress",
                    {
                        params: {
                            address,
                            method: 17
                        }
                    }
                ).catch(() => null);
                const timings = result?.data?.timings;
                if (
                    result?.code !== 200 ||
                    !timings?.Fajr ||
                    !timings?.Dhuhr ||
                    !timings?.Asr ||
                    !timings?.Maghrib ||
                    !timings?.Isha
                )
                    return null;
                return result.data;
            };
            let result = await getTimings(query);
            let location = query;
            if (!result) {
                const geo = await fetchJson(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    {
                        params: {
                            name: query,
                            count: 10,
                            language: "ms",
                            format: "json"
                        }
                    }
                ).catch(() => null);
                const places = geo?.results ?? [];
                for (const place of places) {
                    const region = place.admin1 || place.name;
                    const address = [region, place.country]
                        .filter(Boolean)
                        .join(", ");
                    if (!address) continue;
                    result = await getTimings(address);
                    if (result) {
                        location = address;
                        break;
                    }
                }
            }
            if (!result)
                throw new UserError(
                    `Waktu solat untuk "${query}" tidak dijumpai.`
                );

            const t = result.timings;
            const date = result.date?.readable ?? "-";

            return m.reply(
                [
                    `🕌 *WAKTU SOLAT*`,
                    `Lokasi: ${location}`,
                    `Tarikh: ${date}`,
                    ``,
                    `Subuh   : ${t.Fajr}`,
                    `Syuruk  : ${t.Sunrise}`,
                    `Zohor   : ${t.Dhuhr}`,
                    `Asar    : ${t.Asr}`,
                    `Maghrib : ${t.Maghrib}`,
                    `Isyak   : ${t.Isha}`,
                    ``,
                    `_Sumber: Aladhan API_`
                ].join("\n")
            );
        }
    },
    {
        command: ["waktu", "time", "zon"],
        help: ["waktu <zon masa, cth Asia/Tokyo>"],
        tags: ["internet"],
        exec: (m, { text }) => {
            const zone = text || config.bot.timezone;
            try {
                const formatted = new Date().toLocaleString("ms-MY", {
                    timeZone: zone,
                    dateStyle: "full",
                    timeStyle: "medium"
                });
                return m.reply(`🕒 *${zone}*\n${formatted}`);
            } catch {
                throw new UserError(
                    "Zon masa tidak sah. Contoh: Asia/Kuala_Lumpur, Europe/London"
                );
            }
        }
    }
];
