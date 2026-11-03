import { cleanNumber } from "#lib/utils.js";
import { buildListText, startFromMessage, stopFromMessage } from "#jadibot/msgjadibot.js";
import { normalizeId } from "#jadibot/manager.js";

const NUMBER_PATTERN = /^\d{8,15}$/;

export default [
    {
        command: ["jadibot", "becomebot"],
        help: ["jadibot", "jadibot <nombor>", "jadibot --qr"],
        tags: ["jadibot"],
        official: true,
        description: "Jadikan nombor anda sebagai bot (kod pairing atau QR)",
        exec: async (m, ctx) => {
            const arg = ctx.args[0]?.toLowerCase();
            if (arg === "--qr" || arg === "qr") return startFromMessage(m, ctx, { method: "qr" });

            const number = cleanNumber(arg && arg !== "me" ? arg : m.userId.endsWith("@s.whatsapp.net") ? m.number : "");
            if (!NUMBER_PATTERN.test(number)) {
                return m.reply(
                    `Tulis nombor anda dengan kod negara.\nContoh: ${ctx.prefix}jadibot 60123456789\nAtau guna QR: ${ctx.prefix}jadibot --qr`
                );
            }
            return startFromMessage(m, ctx, { method: "pairing", number });
        }
    },
    {
        command: ["stopjadibot", "stopbot"],
        help: ["stopjadibot [nombor|me]"],
        tags: ["jadibot"],
        official: true,
        exec: (m, ctx) => stopFromMessage(m, ctx, ctx.args[0] ? normalizeId(ctx.args[0]) : "")
    },
    {
        command: ["listjadibot"],
        help: ["listjadibot"],
        tags: ["jadibot"],
        official: true,
        exec: (m, ctx) => m.reply(buildListText({ onlyOwner: ctx.isOwner ? "" : m.number }))
    }
];
