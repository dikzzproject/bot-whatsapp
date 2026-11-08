const sessions = new SessionStore({ ttl: 120000 });
const BOMBS = 3;
const SAFE_PRIZE = 80;

const board = session =>
    session.cells
        .map((cell, index) => (cell.open ? (cell.bomb ? "💥" : "✅") : `${index + 1}️⃣`))
        .reduce((rows, cell, index) => {
            if (index % 3 === 0) rows.push([]);
            rows[rows.length - 1].push(cell);
            return rows;
        }, [])
        .map(row => row.join(" "))
        .join("\n");

export default [
    {
        command: ["tebakbom", "bomb"],
        help: ["tebakbom"],
        tags: ["game"],
        group: true,
        exec: async m => {
            if (sessions.has(m.chat)) return m.reply("Permainan tebak bom masih berjalan.");

            const cells = Array.from({ length: 9 }, () => ({ bomb: false, open: false }));
            let placed = 0;
            while (placed < BOMBS) {
                const index = randomInt(0, 8);
                if (!cells[index].bomb) {
                    cells[index].bomb = true;
                    placed++;
                }
            }

            const session = sessions.start(m.chat, { cells, player: m.userId, earned: 0 });
            await m.reply(`💣 *Tebak Bom* — ada ${BOMBS} bom.\nTaip nombor 1-9 untuk membuka kotak. Setiap kotak selamat +${SAFE_PRIZE} wang. Taip *stop* untuk tunai keluar.\n\n${board(session)}`);
        }
    },
    {
        before: async (m, ctx) => {
            const session = sessions.get(m.chat);
            if (!session || m.fromMe || ctx.command) return false;
            if (session.player !== m.userId) return false;

            if (/^(stop|tunai)$/i.test(m.text.trim())) {
                sessions.end(m.chat);
                reward(ctx.user, { money: session.earned, exp: 10 });
                await m.reply(`💰 Anda berhenti dan membawa pulang ${session.earned} wang.`);
                return true;
            }
            if (!/^[1-9]$/.test(m.text.trim())) return false;

            const cell = session.cells[Number(m.text.trim()) - 1];
            if (cell.open) {
                await m.reply("Kotak itu sudah dibuka.");
                return true;
            }
            cell.open = true;

            if (cell.bomb) {
                session.cells.forEach(item => (item.open = true));
                sessions.end(m.chat);
                await m.reply(`💥 *BOOM!* Anda terkena bom.\n\n${board(session)}\n\nHadiah hangus.`);
                return true;
            }

            session.earned += SAFE_PRIZE;
            const remaining = session.cells.filter(item => !item.bomb && !item.open).length;
            if (!remaining) {
                sessions.end(m.chat);
                reward(ctx.user, { money: session.earned, exp: 40 });
                await m.reply(`🏆 Anda membuka semua kotak selamat!\n+${session.earned} wang, +40 exp.\n\n${board(session)}`);
                return true;
            }
            await m.reply(`✅ Selamat! Terkumpul: ${session.earned}\n\n${board(session)}`);
            return true;
        }
    }
];
