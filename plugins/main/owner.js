
const numbers = config.owner.number.filter(number => number.length <= 13);

export default {
    command: ["owner", "creator", "developer"],
    help: ["owner"],
    tags: ["main"],
    description: "Hubungi pemilik bot",
    exec: async (m, { sock }) => {
        const contacts = numbers.map((number, index) => ({
            vcard: [
                "BEGIN:VCARD",
                "VERSION:3.0",
                `FN:${config.owner.name} ${index + 1}`,
                `TEL;type=CELL;waid=${number}:+${number}`,
                "END:VCARD"
            ].join("\n")
        }));
        return sock.sendMessage(
            m.chat,
            { contacts: { displayName: config.owner.name, contacts } },
            { quoted: m }
        );
    }
};
