import { reward } from "#lib/economy.js";
import { addItem, itemLabel } from "#lib/items.js";
import { randomInt } from "#lib/utils.js";

const ACTIVITIES = [
    { command: ["mining", "melombong"], emoji: "⛏️", text: "melombong di gua", cost: 12, cooldown: 300, money: [20, 80], exp: [10, 25], loot: [["batu", [2, 6], 1], ["besi", [1, 3], 0.6], ["emas", [1, 1], 0.2], ["berlian", [1, 1], 0.04]] },
    { command: ["nebang", "tebang"], emoji: "🪓", text: "menebang pokok", cost: 8, cooldown: 180, money: [10, 50], exp: [8, 18], loot: [["kayu", [3, 8], 1]] },
    { command: ["mancing", "memancing"], emoji: "🎣", text: "memancing di tasik", cost: 6, cooldown: 180, money: [10, 60], exp: [8, 20], loot: [["ikan", [1, 4], 1], ["sampah", [1, 2], 0.3]] },
    { command: ["mulung", "kutip"], emoji: "🧺", text: "mengutip barang terbuang", cost: 5, cooldown: 120, money: [5, 30], exp: [5, 12], loot: [["sampah", [2, 6], 1]] },
    { command: ["berburu", "hunt", "berburuan"], emoji: "🏹", text: "memburu di hutan", cost: 15, cooldown: 420, money: [30, 120], exp: [15, 35], loot: [["daging", [1, 4], 1]] },
    { command: ["berkebun"], emoji: "🌱", text: "berkebun sayur", cost: 7, cooldown: 240, money: [15, 60], exp: [8, 20], loot: [["sayur", [3, 8], 1]] },
    { command: ["kerja"], emoji: "💼", text: "bekerja sepenuh masa", cost: 10, cooldown: 600, money: [100, 300], exp: [20, 50], loot: [] },
    { command: ["nguli"], emoji: "🧱", text: "bekerja sebagai buruh", cost: 12, cooldown: 400, money: [60, 160], exp: [12, 30], loot: [["batu", [1, 3], 0.5]] },
    { command: ["berdagang", "dagang"], emoji: "🛒", text: "berniaga di pasar", cost: 9, cooldown: 360, money: [40, 200], exp: [10, 28], loot: [] }
];

export default ACTIVITIES.map(activity => ({
    command: activity.command,
    help: [activity.command[0]],
    tags: ["rpg"],
    cooldown: activity.cooldown,
    exec: (m, { user }) => {
        if (user.health < activity.cost) {
            return m.reply(`😵 Nyawa anda terlalu rendah (${user.health}/100). Gunakan .heal atau .rest dahulu.`);
        }
        user.health -= activity.cost;

        const money = randomInt(...activity.money);
        const exp = randomInt(...activity.exp);
        const { leveledUp, level } = reward(user, { money, exp });

        const found = [];
        for (const [key, range, chance] of activity.loot) {
            if (Math.random() > chance) continue;
            const amount = randomInt(...range);
            addItem(user, key, amount);
            found.push(`${itemLabel(key)} x${amount}`);
        }

        const lines = [
            `${activity.emoji} Anda ${activity.text}.`,
            `💰 +${money} wang • ✨ +${exp} exp • ❤️ -${activity.cost} nyawa`,
            found.length ? `🎒 Dapat: ${found.join(", ")}` : ""
        ];
        if (leveledUp) lines.push(`🎉 Naik ke level ${level}!`);
        return m.reply(lines.filter(Boolean).join("\n"));
    }
}));
