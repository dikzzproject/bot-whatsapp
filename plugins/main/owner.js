
const owners = config.owner.number
    .map((number, index) => ({
        number,
        name: config.owner.name[index] || config.owner.name[0]
    }))
    .filter(owner => owner.number.length <= 13);

export default {
    command: ["owner", "creator", "developer"],
    help: ["owner"],
    tags: ["main"],
    description: "Hubungi pemilik bot",

    exec: async (m, { sock }) => {
        const contacts = owners.map(({ number, name }) => ({
            vcard: [
                "BEGIN:VCARD",
                "VERSION:3.0",
                `FN:${name}`,
                `TEL;type=CELL;waid=${number}:+${number}`,
                "END:VCARD"
            ].join("\n")
        }));

        return sock.sendMessage(
            m.chat,
            {
                contacts: {
                    displayName: "Owner Bot",
                    contacts
                }
            },
            { quoted: m }
        );
    }
};
