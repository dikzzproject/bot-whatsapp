import log from "#logger";
import { deepDefaults } from "#lib/utils.js";

export default class Collection {
    constructor(store, factory) {
        this.store = store;
        this.factory = factory;
    }

    get table() {
        return this.store.data;
    }

    get(id) {
        if (!id) {
            log.warn("database", "get() dipanggil tanpa ID. Data tidak akan disimpan.");
            return this.factory();
        }
        const row = this.table[id];
        if (!row) return (this.table[id] = this.factory());
        return deepDefaults(row, this.factory());
    }

    set(id, value) {
        this.table[id] = value;
        return value;
    }

    find(id) {
        return this.table[id] ?? null;
    }

    has(id) {
        return id in this.table;
    }

    remove(id) {
        return delete this.table[id];
    }

    clear() {
        for (const key of Object.keys(this.table)) {
            delete this.table[key];
        }
        return true;
    }

    ids() {
        return Object.keys(this.table);
    }

    entries() {
        return Object.entries(this.table);
    }

    values() {
        return Object.values(this.table);
    }

    filter(callback) {
        return Object.entries(this.table)
            .filter(([id, value]) => callback(value, id))
            .map(([id, value]) => [id, value]);
    }

    get size() {
        return this.ids().length;
    }
}
