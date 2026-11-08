const API = {
    wikt: "https://api.wiktapi.dev/v1/en/word",
    dictionary: "https://api.dictionaryapi.dev/api/v2/entries/en",
    datamuse: "https://api.datamuse.com/words",
    translate: "https://api.mymemory.translated.net/get"
};

const LANGUAGES = {
    ms: "Malay",
    id: "Indonesian",
    en: "English",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    fr: "French",
    de: "German",
    es: "Spanish",
    pt: "Portuguese",
    ru: "Russian",
    th: "Thai",
    hi: "Hindi",
    it: "Italian",
    nl: "Dutch",
    tr: "Turkish"
};

const LANGUAGE_ALIASES = {
    melayu: "ms",
    malaysia: "ms",
    malay: "ms",
    indonesia: "id",
    indonesian: "id",
    inggeris: "en",
    english: "en",
    jepun: "ja",
    japanese: "ja",
    korea: "ko",
    korean: "ko",
    cina: "zh",
    chinese: "zh",
    arab: "ar",
    arabic: "ar"
};

const clean = value =>
    String(value ?? "")
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();

const unique = values => [...new Set(values.filter(Boolean))];

async function request(url) {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "KurukuruBot/1.0"
        },
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        throw new Error(`API Error: HTTP ${response.status}`);
    }

    return response.json();
}

function languageCode(value) {
    const input = String(value ?? "").toLowerCase();

    return LANGUAGE_ALIASES[input] ?? input;
}

// =====================================
// WIKTAPI
// =====================================

async function getWikt(word, lang = null) {
    const url = new URL(`${API.wikt}/${encodeURIComponent(word)}`);

    if (lang) url.searchParams.set("lang", lang);

    const data = await request(url);

    return data?.entries ?? [];
}

// =====================================
// FREE DICTIONARY FALLBACK
// =====================================

async function getEnglishDictionary(word) {
    try {
        const data = await request(
            `${API.dictionary}/${encodeURIComponent(word)}`
        );

        return data?.[0] ?? null;
    } catch {
        return null;
    }
}

// =====================================
// DEFINITIONS
// =====================================

function extractDefinitions(entries) {
    return entries.flatMap(entry =>
        (entry.senses ?? []).flatMap(sense =>
            (sense.glosses ?? []).map(gloss => ({
                word: entry.word,
                language: entry.lang,
                pos: entry.pos,
                definition: clean(gloss)
            }))
        )
    );
}

// =====================================
// EXAMPLES
// =====================================

function extractExamples(entries) {
    return unique(
        entries.flatMap(entry =>
            (entry.senses ?? []).flatMap(sense =>
                (sense.examples ?? []).map(example =>
                    clean(
                        typeof example === "string"
                            ? example
                            : (example.text ?? example.example)
                    )
                )
            )
        )
    );
}

// =====================================
// PHONETIC
// =====================================

function extractPhonetic(entries) {
    return unique(
        entries.flatMap(entry =>
            (entry.sounds ?? []).map(sound =>
                sound.ipa ? `/${sound.ipa.replace(/^\/|\/$/g, "")}/` : null
            )
        )
    );
}

// =====================================
// SYNONYM & ANTONYM
// =====================================

async function getRelations(word, type) {
    const params = new URLSearchParams({
        [type]: word,
        max: "8"
    });

    const data = await request(`${API.datamuse}?${params}`);

    return data.map(item => item.word);
}

// =====================================
// TRANSLATION
// =====================================

async function translateWord(text, from, to) {
    const params = new URLSearchParams({
        q: text,
        langpair: `${from}|${to}`
    });

    const data = await request(`${API.translate}?${params}`);

    const result = data?.responseData?.translatedText;

    if (!result || data.responseStatus !== 200) {
        throw new Error("Terjemahan tidak dijumpai.");
    }

    return clean(result);
}

// =====================================
// FORMAT DICTIONARY
// =====================================

async function dictionary(word, lang = null) {
    let entries = await getWikt(word, lang);

    // Jika tiada hasil, cuba kamus Inggeris
    let english = null;

    if (!entries.length && (!lang || lang === "en")) {
        english = await getEnglishDictionary(word);
    }

    if (!entries.length && !english) return null;

    const definitions = extractDefinitions(entries);
    const examples = extractExamples(entries);
    const phonetics = extractPhonetic(entries);

    if (english) {
        const meanings = english.meanings ?? [];

        definitions.push(
            ...meanings.flatMap(item =>
                item.definitions.slice(0, 3).map(def => ({
                    word: english.word,
                    language: "English",
                    pos: item.partOfSpeech,
                    definition: clean(def.definition)
                }))
            )
        );

        examples.push(
            ...meanings
                .flatMap(item =>
                    item.definitions.map(def => clean(def.example))
                )
                .filter(Boolean)
        );

        phonetics.push(
            ...english.phonetics.map(item => item.text).filter(Boolean)
        );
    }

    return {
        word,
        entries,
        definitions: definitions.slice(0, 8),
        examples: unique(examples).slice(0, 5),
        phonetics: unique(phonetics).slice(0, 5)
    };
}

// =====================================
// PLUGIN
// =====================================

export default {
    command: [
        "kamus",
        "meaning",
        "define",
        "synonym",
        "syn",
        "antonym",
        "ant",
        "translate",
        "terjemah",
        "example",
        "contoh",
        "phonetic",
        "sebutan"
    ],

    help: [
        "kamus <perkataan> [bahasa]",
        "synonym <perkataan>",
        "antonym <perkataan>",
        "translate <teks> <dari>-<ke>",
        "example <perkataan>",
        "phonetic <perkataan>"
    ],

    tags: ["internet"],

    exec: async (m, { command, text, args }) => {
        const cmd = command.toLowerCase();

        if (!text?.trim()) {
            return m.reply(
                [
                    "*DICTIONARY MENU*",
                    "",
                    ".kamus hello",
                    ".kamus cinta ms",
                    ".synonym happy",
                    ".antonym happy",
                    ".translate hello en-ms",
                    ".example beautiful",
                    ".phonetic hello"
                ].join("\n")
            );
        }

        try {
            // =========================
            // TRANSLATE
            // =========================

            if (["translate", "terjemah"].includes(cmd)) {
                const match = text.match(
                    /^(.+?)\s+([a-z]{2,3})-([a-z]{2,3})$/i
                );

                if (!match) {
                    return m.reply("Format: .translate hello en-ms");
                }

                const [, input, source, target] = match;

                const from = languageCode(source);
                const to = languageCode(target);

                if (!LANGUAGES[from] || !LANGUAGES[to]) {
                    return m.reply("Kod bahasa tidak disokong.");
                }

                const result = await translateWord(input.trim(), from, to);

                return m.reply(
                    [
                        "*TRANSLATION*",
                        "",
                        `${LANGUAGES[from]}: ${input}`,
                        `${LANGUAGES[to]}: ${result}`
                    ].join("\n")
                );
            }

            const word = args?.[0]?.trim();

            if (!word) {
                return m.reply("Masukkan perkataan.");
            }

            // =========================
            // SYNONYM & ANTONYM
            // =========================

            if (["synonym", "syn"].includes(cmd)) {
                const words = await getRelations(word, "rel_syn");

                return m.reply(
                    words.length
                        ? `*SYNONYM: ${word}*\n\n${words.join(", ")}`
                        : "Sinonim tidak dijumpai."
                );
            }

            if (["antonym", "ant"].includes(cmd)) {
                const words = await getRelations(word, "rel_ant");

                return m.reply(
                    words.length
                        ? `*ANTONYM: ${word}*\n\n${words.join(", ")}`
                        : "Antonim tidak dijumpai."
                );
            }

            // =========================
            // LANGUAGE
            // =========================

            const lang = args?.[1] ? languageCode(args[1]) : null;

            if (lang && !LANGUAGES[lang]) {
                return m.reply("Kod bahasa tidak disokong.");
            }

            // =========================
            // DICTIONARY
            // =========================

            const data = await dictionary(word, lang);

            if (!data) {
                return m.reply(`Perkataan "${word}" tidak dijumpai.`);
            }

            // =========================
            // EXAMPLE
            // =========================

            if (["example", "contoh"].includes(cmd)) {
                return m.reply(
                    data.examples.length
                        ? `*EXAMPLE: ${word}*\n\n${data.examples.map((v, i) => `${i + 1}. ${v}`).join("\n")}`
                        : "Contoh ayat tidak dijumpai."
                );
            }

            // =========================
            // PHONETIC
            // =========================

            if (["phonetic", "sebutan"].includes(cmd)) {
                return m.reply(
                    data.phonetics.length
                        ? `*PHONETIC: ${word}*\n\n${data.phonetics.join("\n")}`
                        : "Fonetik tidak dijumpai."
                );
            }

            // =========================
            // FULL DICTIONARY
            // =========================

            const definitions = data.definitions.map(
                (item, index) =>
                    `${index + 1}. ${item.pos ? `_${item.pos}_: ` : ""}${item.definition}`
            );

            const synonyms =
                lang && lang !== "en"
                    ? []
                    : await getRelations(word, "rel_syn").catch(() => []);

            const antonyms =
                lang && lang !== "en"
                    ? []
                    : await getRelations(word, "rel_ant").catch(() => []);

            const output = [
                `📖 *DICTIONARY: ${word}*`,
                "",
                "*DEFINITION*",
                definitions.length ? definitions.join("\n") : "Tiada definisi.",
                "",
                "*PHONETIC*",
                data.phonetics.join(", ") || "-",
                "",
                "*EXAMPLE*",
                data.examples.length
                    ? data.examples.map((v, i) => `${i + 1}. ${v}`).join("\n")
                    : "-",
                "",
                "*SYNONYM*",
                synonyms.join(", ") || "-",
                "",
                "*ANTONYM*",
                antonyms.join(", ") || "-"
            ];

            return m.reply(output.join("\n"));
        } catch (error) {
            console.error("[DICTIONARY ERROR]", error);

            return m.reply("Carian kamus gagal. Sila cuba sebentar lagi.");
        }
    }
};
