const expForLevel = level => 50 * level * (level + 1);

const levelFromExp = exp => {
    let level = 0;
    while (exp >= expForLevel(level + 1)) level++;
    return level;
};

const addExp = (user, amount) => {
    const before = user.level;
    user.exp += Math.max(0, Math.floor(amount));
    user.level = levelFromExp(user.exp);
    return { leveledUp: user.level > before, level: user.level };
};

const isPremium = user => Boolean(user?.premium) && (!user.premiumUntil || user.premiumUntil > Date.now());

const reward = (user, { money = 0, exp = 0, limit = 0 } = {}) => {
    user.money += Math.floor(money);
    user.limit += Math.floor(limit);
    return exp ? addExp(user, exp) : { leveledUp: false, level: user.level };
};

const parseAmount = (value, available) => {
    if (!value) return 0;
    if (/^(all|semua)$/i.test(value)) return Math.floor(available);
    const amount = Math.floor(Number(String(value).replace(/[.,_]/g, "")));
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const ITEMS = {
    potion: { name: "Potion", emoji: "🧪", buy: 300, sell: 120 },
    kayu: { name: "Kayu", emoji: "🪵", buy: 60, sell: 25 },
    batu: { name: "Batu", emoji: "🪨", buy: 80, sell: 35 },
    besi: { name: "Besi", emoji: "⛓️", buy: 200, sell: 90 },
    emas: { name: "Emas", emoji: "🥇", buy: 900, sell: 450 },
    berlian: { name: "Berlian", emoji: "💎", buy: 4000, sell: 2000 },
    ikan: { name: "Ikan", emoji: "🐟", buy: 90, sell: 40 },
    daging: { name: "Daging", emoji: "🥩", buy: 150, sell: 70 },
    sayur: { name: "Sayur", emoji: "🥬", buy: 50, sell: 20 },
    sampah: { name: "Sampah", emoji: "🗑️", buy: 10, sell: 5 }
};

const addItem = (user, key, amount = 1) => {
    user.inventory[key] = (user.inventory[key] ?? 0) + amount;
    return user.inventory[key];
};

const itemLabel = key => {
    const item = ITEMS[key];
    return item ? `${item.emoji} ${item.name}` : key;
};

Object.assign(globalThis, { expForLevel, levelFromExp, addExp, isPremium, reward, parseAmount, ITEMS, addItem, itemLabel });
