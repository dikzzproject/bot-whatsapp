import db from "#database";

const GROUP_OPTIONS = {
    welcome: "Mesej sambutan ahli baharu",
    bye: "Mesej selamat tinggal",
    promote: "Notifikasi naik pangkat admin",
    demote: "Notifikasi turun pangkat admin",
    antilink: "Padam pautan kumpulan WhatsApp"
};

const GLOBAL_OPTIONS = {
    autoread: { label: "Baca mesej automatik", get: () => db.settings.autoRead, set: v => (db.settings.autoRead = v) },
    autotyping: { label: "Menaip automatik", get: () => db.settings.autoTyping, set: v => (db.settings.autoTyping = v) },
    autostatus: {
        label: "Baca status automatik",
        get: () => db.settings.autoReadStatus.enabled,
        set: v => (db.settings.autoReadStatus.enabled = v)
    },
    statusemoji: {
        label: "Reaksi emoji pada status",
        get: () => db.settings.autoReadStatus.emoji,
        set: v => (db.settings.autoReadStatus.emoji = v)
    },
    statusonline: { label: "Sentiasa dalam talian", get: () => db.settings.statusOnline, set: v => (db.settings.statusOnline = v) },
    rejectcall: { label: "Tolak panggilan", get: () => db.settings.rejectCall, set: v => (db.settings.rejectCall = v) },
    self: {
        label: "Mod self (owner sahaja)",
        get: () => db.settings.mode === "self",
        set: v => (db.settings.mode = v ? "self" : "public")
    }
};

export default {
    command: ["enable", "disable", "on", "off"],
    help: ["enable <pilihan>", "disable <pilihan>"],
    tags: ["main"],
    description: "Hidup atau matikan fitur",
    exec: async (m, ctx) => {
        const { command, args, group, isOwner, isAdmin, prefix } = ctx;
        const turnOn = ["enable", "on"].includes(command);
        const option = args[0]?.toLowerCase();

        if (!option) {
            const groupList = Object.entries(GROUP_OPTIONS).map(([key, label]) => `◦ ${key} — ${label}`);
            const globalList = Object.entries(GLOBAL_OPTIONS).map(
                ([key, item]) => `◦ ${key} — ${item.label} [${item.get() ? "ON" : "OFF"}]`
            );
            return m.reply(
                `*Pilihan kumpulan* (admin)\n${groupList.join("\n")}\n\n*Pilihan global* (owner, bot rasmi)\n${globalList.join("\n")}\n\nContoh: ${prefix}enable welcome`
            );
        }

        if (GROUP_OPTIONS[option]) {
            if (!m.isGroup) return m.reply("Pilihan ini hanya untuk kumpulan.");
            if (!isAdmin && !isOwner) return m.reply("Hanya admin kumpulan boleh mengubah pilihan ini.");
            group[option] = turnOn;
            return m.reply(`✅ *${option}* ${turnOn ? "dihidupkan" : "dimatikan"} untuk kumpulan ini.`);
        }

        const globalOption = GLOBAL_OPTIONS[option];
        if (globalOption) {
            if (!isOwner) return m.reply("Hanya owner boleh mengubah pilihan global.");
            if (ctx.sock.isJadibot) return m.reply("Pilihan global hanya boleh diubah pada bot rasmi.");
            globalOption.set(turnOn);
            return m.reply(`✅ ${globalOption.label}: *${turnOn ? "ON" : "OFF"}*`);
        }

        return m.reply(`Pilihan "${option}" tidak dikenali. Taip ${prefix}enable untuk senarai.`);
    }
};
