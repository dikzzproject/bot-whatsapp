import { parseAmount, reward } from "#lib/economy.js";
import { pickRandom } from "#lib/utils.js";

const CHOICES = { batu: "🪨", gunting: "✂️", kertas: "📄" };
const BEATS = { batu: "gunting", gunting: "kertas", kertas: "batu" };

export default {
    command: ["suit", "gbk"],
    help: ["suit <batu|gunting|kertas> [taruhan]"],
    tags: ["game"],
    cooldown: 5,
    exec: async (m, { args, user }) => {
        const pick = (args[0] ?? "").toLowerCase();
        if (!CHOICES[pick]) return m.reply("Pilih: batu, gunting atau kertas.\nContoh: .suit batu 100");

        const bet = args[1] ? parseAmount(args[1], user.money) : 0;
        if (bet > user.money) return m.reply("Wang anda tidak mencukupi untuk taruhan itu.");

        const bot = pickRandom(Object.keys(CHOICES));
        const header = `Anda ${CHOICES[pick]} vs ${CHOICES[bot]} Bot\n`;

        if (pick === bot) return m.reply(`${header}🤝 Seri!`);
        if (BEATS[pick] === bot) {
            reward(user, { money: bet, exp: 10 });
            return m.reply(`${header}🎉 Anda menang${bet ? ` +${bet} wang` : ""}!`);
        }
        reward(user, { money: -bet });
        return m.reply(`${header}😢 Anda kalah${bet ? ` -${bet} wang` : ""}.`);
    }
};
