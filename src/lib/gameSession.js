export default class SessionStore {
    constructor({ ttl = 120000 } = {}) {
        this.ttl = ttl;
        this.sessions = new Map();
    }

    start(key, data, { ttl = this.ttl, onExpire } = {}) {
        this.end(key);
        const timer = setTimeout(() => {
            const session = this.sessions.get(key);
            this.sessions.delete(key);
            if (session) onExpire?.(session);
        }, ttl);
        timer.unref?.();
        const session = { ...data, timer, startedAt: Date.now() };
        this.sessions.set(key, session);
        return session;
    }

    get(key) {
        return this.sessions.get(key) ?? null;
    }

    has(key) {
        return this.sessions.has(key);
    }

    end(key) {
        const session = this.sessions.get(key);
        if (session) clearTimeout(session.timer);
        this.sessions.delete(key);
        return session ?? null;
    }
}
