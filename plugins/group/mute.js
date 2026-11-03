export default [
    {
        command: ["mute", "bisukan"],
        help: ["mute"],
        tags: ["group"],
        group: true,
        admin: true,
        exec: (m, { group }) => {
            group.mute = true;
            return m.reply("🔇 Bot dibisukan. Hanya admin boleh menggunakan arahan.");
        }
    },
    {
        command: ["unmute", "nyahbisu"],
        help: ["unmute"],
        tags: ["group"],
        group: true,
        admin: true,
        exec: (m, { group }) => {
            group.mute = false;
            return m.reply("🔊 Bot dinyahbisukan.");
        }
    }
];
