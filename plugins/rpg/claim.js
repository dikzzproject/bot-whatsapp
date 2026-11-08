const HOUR = 3600 * 1000;

const CLAIMS = [
    { key: "daily", command: ["daily", "harian"], every: 24 * HOUR, money: 500, limit: 20, exp: 50 },
    { key: "weekly", command: ["weekly", "mingguan"], every: 7 * 24 * HOUR, money: 3000, limit: 60, exp: 300 },
    { key: "monthly", command: ["monthly", "bulanan"], every: 30 * 24 * HOUR, money: 12000, limit: 150, exp: 1000 },
    { key: "yearly", command: ["yearly", "tahunan"], every: 365 * 24 * HOUR, money: 150000, limit: 500, exp: 8000 }
];

export default CLAIMS.map(({ key, command, every, ...prize }) => ({
    command,
    help: [command[0]],
    tags: ["rpg"],
    exec: (m, { user }) => {
        const remaining = user.claims[key] + every - Date.now();
        if (remaining > 0) return m.reply(`⏳ Anda sudah menuntut hadiah ini. Cuba lagi dalam ${formatDuration(remaining)}.`);
        user.claims[key] = Date.now();
        const { leveledUp, level } = reward(user, prize);
        return m.reply(
            `🎁 *Hadiah ${key}*\n+${formatNumber(prize.money)} wang\n+${prize.limit} limit\n+${formatNumber(prize.exp)} exp${leveledUp ? `\n\n🎉 Naik ke level ${level}!` : ""}`
        );
    }
}));
