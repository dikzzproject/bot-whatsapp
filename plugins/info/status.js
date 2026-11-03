import os from "node:os";
import db from "#database";
import { getPlugins } from "#lib/plugins.js";
import { registry } from "#lib/registry.js";
import { formatBytes, formatDuration, formatNumber } from "#lib/utils.js";

const uptimeText = () => formatDuration(process.uptime() * 1000);

export default [
    {
        command: ["ping", "speed"],
        help: ["ping"],
        tags: ["info"],
        description: "Semak kelajuan respons bot",
        exec: async (m, { sock }) => {
            const start = performance.now();
            const sent = await m.reply("🏓 Mengukur...");
            const latency = (performance.now() - start).toFixed(0);
            return sock.sendMessage(m.chat, { text: `🏓 *Pong!* ${latency} ms`, edit: sent.key });
        }
    },
    {
        command: ["runtime", "rt"],
        help: ["runtime"],
        tags: ["info"],
        exec: m => m.reply(`⏱️ Bot telah aktif selama ${uptimeText()}.`)
    },
    {
        command: ["serverinfo", "server", "os"],
        help: ["serverinfo"],
        tags: ["info"],
        exec: m => {
            const cpu = os.cpus()[0]?.model ?? "Tidak diketahui";
            const total = os.totalmem();
            const used = total - os.freemem();
            return m.reply(
                [
                    "🖥️ *Maklumat Pelayan*",
                    `OS      : ${os.type()} ${os.release()} (${os.arch()})`,
                    `CPU     : ${cpu} x${os.cpus().length}`,
                    `RAM     : ${formatBytes(used)} / ${formatBytes(total)}`,
                    `Node.js : ${process.version}`,
                    `Uptime  : ${uptimeText()}`
                ].join("\n")
            );
        }
    },
    {
        command: ["dashboard"],
        help: ["dashboard"],
        tags: ["info"],
        exec: m =>
            m.reply(
                [
                    `📊 *Dashboard ${config.bot.name}*`,
                    `Versi    : ${config.bot.version}`,
                    `Users : ${formatNumber(db.users.size)}`,
                    `Group : ${formatNumber(db.groups.size)}`,
                    `Plugin   : ${getPlugins().length}`,
                    `Mode      : ${db.settings.mode}`,
                    `Uptime   : ${uptimeText()}`
                ].join("\n")
            )
    },
    {
        command: ["totaluser"],
        help: ["totaluser"],
        tags: ["info"],
        exec: m => m.reply(`👥 Jumlah pengguna: ${formatNumber(db.users.size)}`)
    },
    {
        command: ["totalfitur"],
        help: ["totalfitur"],
        tags: ["info"],
        exec: m => {
            const total = getPlugins().filter(plugin => plugin.exec).reduce((sum, plugin) => sum + plugin.command.length, 0);
            return m.reply(`🧩 Jumlah perintah: ${total}`);
        }
    },
    {
        command: ["cekid", "id"],
        help: ["cekid"],
        tags: ["info"],
        owner: true,
        exec: (m, { sock }) =>
            m.reply(`🆔 Chat: ${m.chat}\nPengguna: ${m.userId}\nBot: ${sock.botJid}`)
    }
];
