import sharp from "sharp";
import {
    generateWAMessageFromContent,
    generateMessageIDV2,
    prepareWAMessageMedia
} from "@whiskeysockets/baileys";

async function fetchBuffer(input) {
    if (Buffer.isBuffer(input)) return input;
    try {
        const res = await fetch(input);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
}
async function resizeThumb(buffer) {
    return await sharp(buffer)
        .resize(300, 300, {
            fit: "cover",
            position: "center",
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .jpeg()
        .toBuffer();
}
function buildButton(btn) {
    switch (btn.type) {
        case "url":
            return {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    url: btn.url,
                    webview_interaction: btn.webview ?? false
                })
            };

        case "call":
            return {
                name: "cta_call",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    id: btn.phone
                })
            };

        case "copy":
            return {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    copy_code: btn.code
                })
            };

        case "list":
            return {
                name: "single_select",
                buttonParamsJson: JSON.stringify({
                    title: btn.text,
                    sections: [
                        {
                            title: btn.sectionTitle || "",
                            highlight_label: "",
                            rows: (btn.rows || []).map(row => ({
                                header: "",
                                title: row.title,
                                description: row.description || "",
                                id: row.id
                            }))
                        }
                    ]
                })
            };

        case "reminder":
            return {
                name: "cta_reminder",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    id: btn.id
                })
            };

        case "cancelReminder":
            return {
                name: "cta_cancel_reminder",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    id: btn.id
                })
            };

        case "address":
            return {
                name: "address_message",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    id: btn.id
                })
            };

        case "location":
            return {
                name: "send_location",
                buttonParamsJson: JSON.stringify({})
            };

        case "reply":
        default:
            return {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    id: btn.id
                })
            };
    }
}
global.sendButton = conn => {
    const state = {
        _text: "",
        _footer: "",
        _headerTitle: "",
        _headerSubtitle: "",
        _thumb: null,
        _buttons: [],
        _quoted: undefined,
        _mentionedJid: [] // Added mentioned array support
    };

    const chain = {
        text(text) {
            state._text = text;
            return chain;
        },

        footer(text) {
            state._footer = text;
            return chain;
        },

        header(title, subtitle = "") {
            state._headerTitle = title;
            state._headerSubtitle = subtitle;
            return chain;
        },

        thumbnail(source) {
            state._thumb = source;
            return chain;
        },

        button(btn) {
            state._buttons.push(btn);
            return chain;
        },

        buttons(list = []) {
            state._buttons.push(...list);
            return chain;
        },

        // Added .mentioned() method matching sendButtonV2
        mentioned(jids = []) {
            state._mentionedJid = Array.isArray(jids) ? jids : [jids];
            return chain;
        },

        quoted(m) {
            state._quoted = m;
            return chain;
        },

        async send(jid) {
            const buttons = state._buttons.map(buildButton);

            const media = state._thumb
                ? await prepareWAMessageMedia(
                      {
                          image: Buffer.isBuffer(state._thumb)
                              ? state._thumb
                              : { url: state._thumb }
                      },
                      { upload: conn.waUploadToServer }
                  )
                : null;

            const content = {
                interactiveMessage: {
                    header: {
                        title: state._headerTitle,
                        subtitle: state._headerSubtitle,
                        hasMediaAttachment: !!media,
                        ...(media || {})
                    },
                    body: { text: state._text },
                    footer: { text: state._footer || global.year || "" },
                    contextInfo: {
                        mentionedJid: state._mentionedJid // Injecting mentionedJid into contextInfo
                    },
                    nativeFlowMessage: {
                        messageParamsJson: JSON.stringify({}),
                        buttons
                    }
                }
            };

            const waMsg = generateWAMessageFromContent(jid, content, {
                messageId: generateMessageIDV2(),
                quoted: state._quoted
            });

            await conn.relayMessage(waMsg.key.remoteJid, waMsg.message, {
                messageId: waMsg.key.id,
                additionalNodes: [
                    {
                        tag: "biz",
                        attrs: {},
                        content: [
                            {
                                tag: "interactive",
                                attrs: { type: "native_flow", v: "1" },
                                content: [
                                    {
                                        tag: "native_flow",
                                        attrs: { v: "9", name: "mixed" }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            return waMsg;
        }
    };

    return chain;
};

// format buttonsMessage: buttonId + buttonText + type:1 + nativeFlowInfo
function buildButtonV2(btn) {
    const base = {
        buttonId: btn.id || btn.phone || btn.type,
        buttonText: { displayText: btn.text || "" },
        type: 1
    };

    switch (btn.type) {
        case "url":
            return {
                ...base,
                nativeFlowInfo: {
                    name: "cta_url",
                    paramsJson: JSON.stringify({
                        display_text: btn.text,
                        url: btn.url,
                        webview_interaction: btn.webview ?? false
                    })
                }
            };

        case "call":
            return {
                ...base,
                buttonId: btn.phone,
                nativeFlowInfo: {
                    name: "cta_call",
                    paramsJson: JSON.stringify({
                        display_text: btn.text,
                        id: btn.phone
                    })
                }
            };

        case "copy":
            return {
                ...base,
                nativeFlowInfo: {
                    name: "cta_copy",
                    paramsJson: JSON.stringify({
                        display_text: btn.text,
                        copy_code: btn.code
                    })
                }
            };

        case "list":
            return {
                ...base,
                nativeFlowInfo: {
                    name: "single_select",
                    paramsJson: JSON.stringify({
                        title: btn.text,
                        sections: [
                            {
                                title: btn.sectionTitle || "",
                                highlight_label: "",
                                rows: (btn.rows || []).map(row => ({
                                    header: "",
                                    title: row.title,
                                    description: row.description || "",
                                    id: row.id
                                }))
                            }
                        ]
                    })
                }
            };

        case "reminder":
            return {
                ...base,
                nativeFlowInfo: {
                    name: "cta_reminder",
                    paramsJson: JSON.stringify({
                        display_text: btn.text,
                        id: btn.id
                    })
                }
            };

        case "cancelReminder":
            return {
                ...base,
                nativeFlowInfo: {
                    name: "cta_cancel_reminder",
                    paramsJson: JSON.stringify({
                        display_text: btn.text,
                        id: btn.id
                    })
                }
            };

        case "address":
            return {
                ...base,
                nativeFlowInfo: {
                    name: "address_message",
                    paramsJson: JSON.stringify({
                        display_text: btn.text,
                        id: btn.id
                    })
                }
            };

        case "location":
            return {
                ...base,
                nativeFlowInfo: {
                    name: "send_location",
                    paramsJson: JSON.stringify({})
                }
            };

        case "reply":
        default:
            // pill button biasa boleh je pakai format lama TANPA nativeFlowInfo
            return base;
    }
}
global.sendButtonV2 = conn => {
    const state = {
        _text: "",
        _footer: "",
        _headerTitle: "",
        _headerSubtitle: "",
        _thumb: null,
        _buttons: [],
        _quoted: undefined,
        _mentionedJid: []
    };

    const chain = {
        text(text) {
            state._text = text;
            return chain;
        },

        footer(text) {
            state._footer = text;
            return chain;
        },

        header(title, subtitle = "") {
            state._headerTitle = title;
            state._headerSubtitle = subtitle;
            return chain;
        },

        thumbnail(source) {
            state._thumb = source; // Buffer atau url string
            return chain;
        },

        button(btn) {
            state._buttons.push(btn);
            return chain;
        },

        buttons(list = []) {
            state._buttons.push(...list);
            return chain;
        },

        mentioned(jids = []) {
            state._mentionedJid = Array.isArray(jids) ? jids : [jids];
            return chain;
        },

        quoted(m) {
            state._quoted = m;
            return chain;
        },

        async send(jid) {
            if (!state._thumb) {
                throw new Error(
                    "sendButtonV2 perlukan .thumbnail() — locationMessage " +
                        "WAJIB ada jpegThumbnail, tak boleh kosong."
                );
            }

            const fetched = await fetchBuffer(state._thumb);
            if (!fetched || !fetched.length) {
                throw new Error("Gagal proses thumbnail (fetch gagal/kosong).");
            }
            const thumb = await resizeThumb(fetched);

            const buttons = state._buttons.map(buildButtonV2);

            const content = {
                buttonsMessage: {
                    contentText: state._text,
                    footerText: state._footer || global.year || "",
                    headerType: 6,
                    locationMessage: {
                        degreesLatitude: 0,
                        degreesLongitude: 0,
                        name: state._headerTitle,
                        address: state._headerSubtitle,
                        jpegThumbnail: thumb
                    },
                    viewOnce: true,
                    contextInfo: {
                        mentionedJid: state._mentionedJid
                    },
                    buttons
                }
            };

            const waMsg = generateWAMessageFromContent(jid, content, {
                messageId: generateMessageIDV2(),
                quoted: state._quoted
            });

            await conn.relayMessage(waMsg.key.remoteJid, waMsg.message, {
                messageId: waMsg.key.id,
                additionalNodes: [
                    {
                        tag: "biz",
                        attrs: {},
                        content: [
                            {
                                tag: "interactive",
                                attrs: { type: "native_flow", v: "1" },
                                content: [
                                    {
                                        tag: "native_flow",
                                        attrs: { v: "9", name: "mixed" }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            return waMsg;
        }
    };

    return chain;
};

global.sendNewsletter = conn => {
    const state = {
        _text: "",
        _newsletterName: global.nameChannel,
        _newsletterJid: global.newsletter,
        _forwardingScore: 1,
        _mentionedJid: [],
        _thumb: null,
        _quoted: undefined
    };

    const chain = {
        text(text) {
            state._text = text;
            return chain;
        },

        newsletter(name, jid) {
            state._newsletterName = name;
            state._newsletterJid = jid;
            return chain;
        },

        thumbnail(s) {
            state._thumb = s;
            return chain;
        },

        forwardingScore(score) {
            state._forwardingScore = score;
            return chain;
        },

        mentioned(jids = []) {
            state._mentionedJid = Array.isArray(jids) ? jids : [jids];
            return chain;
        },

        quoted(m) {
            state._quoted = m;
            return chain;
        },

        async send(jid) {
            if (!jid) {
                throw new Error(
                    "Target JID tidak boleh kosong pada .send(jid)"
                );
            }

            if (!state._newsletterJid) {
                throw new Error(
                    "sendNewsletter memerlukan .newsletter(name, jid) dengan format xxxxxxxxxxxxx@newsletter."
                );
            }

            // Opsi konteks newsletter & forward
            const contextInfo = {
                mentionedJid: state._mentionedJid,
                forwardingScore: state._forwardingScore,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterName: state._newsletterName,
                    newsletterJid: state._newsletterJid
                }
            };

            // Payload pesan dinamis
            let messagePayload = {};

            if (state._thumb) {
                const isUrl =
                    typeof state._thumb === "string" &&
                    (state._thumb.startsWith("http://") ||
                        state._thumb.startsWith("https://"));
                messagePayload = {
                    image: isUrl ? { url: state._thumb } : state._thumb,
                    caption: state._text || "",
                    contextInfo
                };
            } else {
                messagePayload = {
                    text: state._text || "",
                    contextInfo
                };
            }

            // Menggunakan conn.sendMessage yang otomatis menangani enkripsi Signal
            return await conn.sendMessage(jid, messagePayload, {
                quoted: state._quoted
            });
        }
    };

    return chain;
};

global.fstatus = {
    key: {
        remoteJid: "status@broadcast",
        participant: "0@s.whatsapp.net",
        fromMe: false,
        id: ""
    },
    message: {
        imageMessage: {
            mimetype: "image/jpeg",
            caption: `💬`,
            jpegThumbnail: ""
        }
    }
};
