export const expForLevel = level => 50 * level * (level + 1);

export const levelFromExp = exp => {
    let level = 0;
    while (exp >= expForLevel(level + 1)) level++;
    return level;
};

export const addExp = (user, amount) => {
    const before = user.level;
    user.exp += Math.max(0, Math.floor(amount));
    user.level = levelFromExp(user.exp);
    return { leveledUp: user.level > before, level: user.level };
};

export const isPremium = user =>
    Boolean(user?.premium) && (!user.premiumUntil || user.premiumUntil > Date.now());

export const reward = (user, { money = 0, exp = 0, limit = 0 } = {}) => {
    user.money += Math.floor(money);
    user.limit += Math.floor(limit);
    return exp ? addExp(user, exp) : { leveledUp: false, level: user.level };
};

export const parseAmount = (value, available) => {
    if (!value) return 0;
    if (/^(all|semua)$/i.test(value)) return Math.floor(available);
    const amount = Math.floor(Number(String(value).replace(/[.,_]/g, "")));
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
};
