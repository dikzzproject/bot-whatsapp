export const ITEMS = {
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

export const addItem = (user, key, amount = 1) => {
    user.inventory[key] = (user.inventory[key] ?? 0) + amount;
    return user.inventory[key];
};

export const itemLabel = key => {
    const item = ITEMS[key];
    return item ? `${item.emoji} ${item.name}` : key;
};
