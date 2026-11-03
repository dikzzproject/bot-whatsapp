export default class TTLCache {
    constructor({ ttl = 60 * 60 * 1000, max = 500 } = {}) {
        this.ttl = ttl;
        this.max = max;
        this.store = new Map();
    }

    set(key, value, ttl = this.ttl) {
        if (this.store.size >= this.max) this.store.delete(this.store.keys().next().value);
        this.store.set(key, { value, expires: Date.now() + ttl });
        return value;
    }

    get(key) {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (entry.expires < Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    has(key) {
        return this.get(key) !== undefined;
    }

    delete(key) {
        return this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }
}
