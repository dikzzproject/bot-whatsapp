const { getPlugins } = pluginLoader;
const { OWNER_ONLY } = ownerKit;

export default {
    ...OWNER_ONLY,
    command: ["ownermenu", "menuowner", "ownerlist"],
    help: ["ownermenu"],
    exec: (m, { prefix }) => {
        const lines = getPlugins()
            .filter(plugin => plugin.exec && plugin.category === "owner")
            .flatMap(plugin => plugin.help.map(item => `> ${prefix}${item}`));
        const unique = [...new Set(lines)];
        return m.reply(
            `📂 *OWNER LIST*\n${unique.join("\n")}\n\n*Terminal (tanpa awalan):*\n> => <ungkapan>\n> > <kod async>\n> $ <perintah shell>`
        );
    }
};
