const MAX_BET = 50000;
const REELS = ["🍒", "🍋", "🍇", "🔔", "💎", "7️⃣"];

const readBet = (args, user) => {
    const bet = parseAmount(args[0], Math.min(user.money, MAX_BET));
    if (!bet) return { error: `Tulis jumlah taruhan. Contoh: .judi 500 (maksimum ${formatNumber(MAX_BET)})` };
    if (bet > user.money) return { error: "Wang anda tidak mencukupi." };
    if (bet > MAX_BET) return { error: `Taruhan maksimum ialah ${formatNumber(MAX_BET)}.` };
    return { bet };
};

export default [
    {
        command: ["judi", "gamble"],
        help: ["judi <jumlah|all>"],
        tags: ["rpg"],
        cooldown: 10,
        exec: (m, { args, user }) => {
            const { bet, error } = readBet(args, user);
            if (error) return m.reply(error);
            const win = Math.random() < 0.45;
            user.money += win ? bet : -bet;
            return m.reply(
                win
                    ? `🎲 Anda menang +${formatNumber(bet)} wang!\n💰 Baki: ${formatNumber(user.money)}`
                    : `🎲 Anda kalah -${formatNumber(bet)} wang.\n💰 Baki: ${formatNumber(user.money)}`
            );
        }
    },
    {
        command: ["casino", "slot"],
        help: ["slot <jumlah|all>"],
        tags: ["rpg"],
        cooldown: 10,
        exec: (m, { args, user }) => {
            const { bet, error } = readBet(args, user);
            if (error) return m.reply(error);
            const spin = [pickRandom(REELS), pickRandom(REELS), pickRandom(REELS)];
            const unique = new Set(spin).size;
            const multiplier = unique === 1 ? 5 : unique === 2 ? 1.5 : 0;
            const change = multiplier ? Math.floor(bet * multiplier) - bet : -bet;
            user.money += change;
            return m.reply(
                `🎰 ${spin.join(" | ")}\n${multiplier ? `🎉 Menang ×${multiplier} (+${formatNumber(change)})` : `😢 Kalah -${formatNumber(bet)}`}\n💰 Baki: ${formatNumber(user.money)}`
            );
        }
    },
    {
        command: ["maling", "rompak"],
        help: ["maling <@tag>"],
        tags: ["rpg"],
        group: true,
        cooldown: 1800,
        exec: (m, { user, db }) => {
            if (!m.target || m.target === m.userId) return m.reply("Tag mangsa anda (bukan diri sendiri).");
            const victim = db.users.find(m.target);
            if (!victim || victim.money < 200) return m.reply("Mangsa itu terlalu miskin untuk dirompak.");

            if (Math.random() < 0.4) {
                const loot = Math.min(randomInt(50, 500), Math.floor(victim.money * 0.15));
                victim.money -= loot;
                user.money += loot;
                return m.reply(`🦹 Berjaya! Anda mencuri ${formatNumber(loot)} wang daripada @${m.target.split("@")[0]}.`, { mentions: [m.target] });
            }
            const fine = Math.min(100, user.money);
            user.money -= fine;
            return m.reply(`🚔 Anda tertangkap dan didenda ${formatNumber(fine)} wang.`);
        }
    }
];
