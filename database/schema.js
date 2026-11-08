
export const createUser = () => ({
    name: "",
    registered: false,
    age: 0,
    registeredAt: 0,
    level: 0,
    exp: 0,
    limit: config.economy.defaultLimit,
    money: config.economy.startMoney,
    bank: 0,
    health: 100,
    premium: false,
    premiumUntil: 0,
    banned: false,
    afk: { since: 0, reason: "" },
    claims: { daily: 0, weekly: 0, monthly: 0, yearly: 0 },
    inventory: {},
    partner: "",
    proposal: { from: "", at: 0 },
    commandCount: 0,
    lastSeen: 0
});

export const createGroup = () => ({
    name: "",
    welcome: false,
    bye: false,
    promote: false,
    demote: false,
    antilink: false,
    mute: false,
    texts: { welcome: "", bye: "", promote: "", demote: "" },
    warns: {},
    stats: {},
    absen: { open: false, note: "", list: {} }
});
