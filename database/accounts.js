export default class AccountRepository {
    constructor(store) {
        this.store = store;
    }

    get data() {
        return this.store.data;
    }

    find(email) {
        return this.data.accounts[String(email).trim().toLowerCase()] ?? null;
    }

    findByGoogle(sub) {
        return Object.values(this.data.accounts).find(account => account.googleSub === sub) ?? null;
    }

    findByOwnerId(ownerId) {
        return Object.values(this.data.accounts).filter(account => account.ownerIds.includes(ownerId));
    }

    create({ email, name = "", passHash = "", salt = "", waNumber = "", ownerIds = [], googleSub = "" }) {
        const key = String(email).trim().toLowerCase();
        this.data.accounts[key] = {
            email: key,
            name,
            passHash,
            salt,
            waNumber,
            ownerIds,
            googleSub,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        return this.data.accounts[key];
    }

    update(email, patch) {
        const account = this.find(email);
        if (!account) return null;
        Object.assign(account, patch, { updatedAt: Date.now() });
        return account;
    }

    remove(email) {
        const key = String(email).trim().toLowerCase();
        for (const [hash, session] of Object.entries(this.data.sessions)) {
            if (session.email === key) delete this.data.sessions[hash];
        }
        for (const [hash, reset] of Object.entries(this.data.resets)) {
            if (reset.email === key) delete this.data.resets[hash];
        }
        return delete this.data.accounts[key];
    }

    all() {
        return Object.values(this.data.accounts);
    }

    addLogin(hash, email, expires) {
        this.data.sessions[hash] = { email, expires, createdAt: Date.now() };
    }

    getLogin(hash) {
        const session = this.data.sessions[hash];
        if (!session) return null;
        if (session.expires < Date.now()) {
            delete this.data.sessions[hash];
            return null;
        }
        return session;
    }

    removeLogin(hash) {
        return delete this.data.sessions[hash];
    }

    removeLoginsOf(email) {
        for (const [hash, session] of Object.entries(this.data.sessions)) {
            if (session.email === email) delete this.data.sessions[hash];
        }
    }

    addReset(hash, email, expires) {
        this.data.resets[hash] = { email, expires };
    }

    takeReset(hash) {
        const reset = this.data.resets[hash];
        delete this.data.resets[hash];
        return reset && reset.expires > Date.now() ? reset : null;
    }

    purge() {
        const now = Date.now();
        for (const [hash, session] of Object.entries(this.data.sessions)) if (session.expires < now) delete this.data.sessions[hash];
        for (const [hash, reset] of Object.entries(this.data.resets)) if (reset.expires < now) delete this.data.resets[hash];
    }
}
