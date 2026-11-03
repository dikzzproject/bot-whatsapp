export default {
    command: ["restart"],
    help: ["restart"],
    tags: ["main"],
    owner: true,
    official: true,
    hidden: true,
    exec: async m => {
        await m.reply("🔄 Memulakan semula bot...");
        if (!process.send) return m.reply("Bot tidak dijalankan melalui index.js, restart dibatalkan.");
        setTimeout(() => process.send("reset"), 1000);
    }
};
