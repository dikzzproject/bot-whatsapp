const sessions = new Map();
const CANCEL_WORDS = /^(cancel|batal|exit|keluar)$/i;
const DEFAULT_TTL = 5 * 60 * 1000;

const keyOf = m => `${m.chat}|${m.userId}`;

function end(key) {
    const session = sessions.get(key);
    if (session) clearTimeout(session.timer);
    sessions.delete(key);
    return session ?? null;
}

function advance(session) {
    while (session.index < session.steps.length) {
        const step = session.steps[session.index];
        if (!step.when || step.when(session.answers)) return step;
        session.index++;
    }
    return null;
}

async function ask(m, ctx, session) {
    const step = advance(session);
    if (!step) return false;
    const question = typeof step.ask === "function" ? step.ask(session.answers, ctx) : step.ask;
    await m.reply(`${question}\n\n_(Taip *batal* untuk berhenti)_`);
    return true;
}

export function start(m, ctx, { steps, onDone, onCancel, ttl = DEFAULT_TTL, onExpire }) {
    const key = keyOf(m);
    end(key);
    const session = { steps, index: 0, answers: {}, onDone, onCancel, timer: null };
    session.timer = setTimeout(() => {
        end(key);
        onExpire?.();
        ctx.sock.sendMessage(m.chat, { text: "⌛ Sesi soal-jawab tamat masa. Taip semula arahan untuk bermula." }).catch(() => null);
    }, ttl);
    session.timer.unref?.();
    sessions.set(key, session);
    return ask(m, ctx, session);
}

export const has = m => sessions.has(keyOf(m));
export const cancel = m => Boolean(end(keyOf(m)));

export async function handle(m, ctx) {
    const key = keyOf(m);
    const session = sessions.get(key);
    if (!session || m.fromMe || !m.text || ctx.plugin) return false;

    const input = m.text.trim();
    if (CANCEL_WORDS.test(input)) {
        end(key);
        await session.onCancel?.(m, ctx);
        await m.reply("❌ Sesi dibatalkan.");
        return true;
    }

    const step = advance(session);
    if (!step) {
        end(key);
        return false;
    }

    let result;
    try {
        result = step.parse ? await step.parse(input, session.answers, ctx) : { value: input };
    } catch (error) {
        if (!(error instanceof UserError)) throw error;
        result = { error: error.message };
    }

    if (result?.error) {
        await m.reply(`❌ ${result.error}\n\n_(Taip *batal* untuk berhenti)_`);
        return true;
    }

    session.answers[step.key] = result && "value" in result ? result.value : input;
    session.index++;

    if (advance(session)) {
        await ask(m, ctx, session);
        return true;
    }

    end(key);
    try {
        await session.onDone(session.answers, m, ctx);
    } catch (error) {
        if (error instanceof UserError) await m.reply(error.message);
        else {
            log.error("wizard", "Ralat semasa menyiapkan sesi soal-jawab", error);
            await m.reply(config.messages.error);
        }
    }
    return true;
}

global.wizard = { start, handle, has, cancel, end };
