const TYPES = [
    { command: ["setwelcome"], key: "welcome", label: "sambutan" },
    { command: ["setbye"], key: "bye", label: "selamat tinggal" },
    { command: ["setpromote"], key: "promote", label: "naik pangkat" },
    { command: ["setdemote"], key: "demote", label: "turun pangkat" }
];

export default TYPES.map(({ command, key, label }) => ({
    command,
    help: [`${command[0]} <teks>`],
    tags: ["group"],
    group: true,
    admin: true,
    needText: `Tulis teks ${label}. Placeholder: @user, @group, @desc`,
    exec: async (m, { group, text }) => {
        group.texts[key] = text;
        group[key] = true;
        return m.reply(`✅ Teks ${label} disimpan dan fitur dihidupkan.`);
    }
}));
