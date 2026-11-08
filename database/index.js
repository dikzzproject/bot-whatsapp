import path from "node:path";
import { deepDefaults, today } from "#lib/utils.js";
import JsonStore from "./json.js";
import Collection from "./collection.js";
import JadibotRepository from "./jadibot.js";
import AccountRepository from "./accounts.js";
import { createGroup, createUser } from "./schema.js";
import blacklistSeed from "./assets/blacklist.js";

const file = name => path.join(config.paths.data, name);

const usersStore = new JsonStore(file("users.json"));
const groupsStore = new JsonStore(file("groups.json"));
const settingsStore = new JsonStore(file("settings.json"), {
    ...global.defaultSettings,
    blacklist: [...blacklistSeed]
});
const jadibotStore = new JsonStore(file("jadibot.json"), {
    sessions: {},
    bannedNumbers: {},
    bannedChats: {}
});

deepDefaults(settingsStore.data, global.defaultSettings);

const accountsStore = new JsonStore(file("accounts.json"), { accounts: {}, sessions: {}, resets: {} });

const stores = [usersStore, groupsStore, settingsStore, jadibotStore, accountsStore];
let timer = null;

const db = {
    users: new Collection(usersStore, createUser),
    groups: new Collection(groupsStore, createGroup),
    settings: settingsStore.data,
    jadibot: new JadibotRepository(jadibotStore),
    accounts: new AccountRepository(accountsStore),

    get data() {
        return { users: usersStore.data, groups: groupsStore.data, settings: settingsStore.data };
    },

    async write() {
        db.flush();
    },

    flush() {
        for (const store of stores) store.save();
    },

    start(interval = 15000) {
        if (timer) return;
        timer = setInterval(() => db.flush(), interval);
        timer.unref();
    },

    stop() {
        clearInterval(timer);
        timer = null;
        db.flush();
    },

    refreshDaily() {
        const date = today();
        if (db.settings.lastReset === date) return;
        for (const [, user] of db.users.entries()) {
            if (user.limit < config.economy.defaultLimit) user.limit = config.economy.defaultLimit;
        }
        db.settings.lastReset = date;
    }
};

export default db;
global.db = db;
