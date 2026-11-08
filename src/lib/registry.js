export const registry = {
    official: null,
    jadibots: new Map(),
    startedAt: Date.now()
};

export const getOfficial = () => registry.official;

export const setOfficial = sock => {
    registry.official = sock;
};
global.registry = registry;
