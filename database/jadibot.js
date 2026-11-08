import { cleanNumber } from "#lib/utils.js";

export default class JadibotRepository {
    constructor(store) {
        this.store = store;
    }

    get data() {
        return this.store.data;
    }

    listSessions() {
        return Object.entries(this.data.sessions).map(([id, info]) => ({ id, ...info }));
    }

    getSession(id) {
        return this.data.sessions[id] ?? null;
    }

    findSessions(query) {
        const needle = String(query ?? "").trim().toLowerCase();
        const digits = cleanNumber(needle);
        if (!needle) return [];
        const exact = this.listSessions().filter(
            item =>
                item.id.toLowerCase() === needle ||
                String(item.name ?? "").toLowerCase() === needle ||
                (digits.length >= 6 && (item.number === digits || item.pairNumber === digits))
        );
        if (exact.length) return exact;
        return this.listSessions().filter(
            item => needle.length >= 3 && (String(item.name ?? "").toLowerCase().includes(needle) || item.id.toLowerCase().startsWith(needle))
        );
    }

    listByEmail(email) {
        return this.listSessions().filter(item => item.accountEmail === String(email).toLowerCase());
    }

    listByOwner(digitsList) {
        return this.listSessions().filter(item => (item.owners ?? []).some(owner => digitsList.includes(owner)));
    }

    saveSession(id, patch) {
        const current = this.data.sessions[id] ?? { createdAt: Date.now() };
        this.data.sessions[id] = { ...current, ...patch, updatedAt: Date.now() };
        return this.data.sessions[id];
    }

    removeSession(id) {
        return delete this.data.sessions[id];
    }

    isBanned(number) {
        return cleanNumber(number) in this.data.bannedNumbers;
    }

    banNumber(number, reason = "Tiada sebab", by = "") {
        this.data.bannedNumbers[cleanNumber(number)] = { reason, by, at: Date.now() };
    }

    unbanNumber(number) {
        return delete this.data.bannedNumbers[cleanNumber(number)];
    }

    listBannedNumbers() {
        return Object.entries(this.data.bannedNumbers).map(([number, info]) => ({ number, ...info }));
    }

    isChatBanned(jid) {
        return jid in this.data.bannedChats;
    }

    banChat(jid, reason = "Tiada sebab", by = "") {
        this.data.bannedChats[jid] = { reason, by, at: Date.now() };
    }

    unbanChat(jid) {
        return delete this.data.bannedChats[jid];
    }

    listBannedChats() {
        return Object.entries(this.data.bannedChats).map(([jid, info]) => ({ jid, ...info }));
    }
}
