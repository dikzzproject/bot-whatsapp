const { CEK_ATTRIBUTES, REMARKS } = assets.fun;

const remarkFor = percent =>
    pickRandom(
        percent < 34 ? REMARKS.low : percent < 67 ? REMARKS.mid : REMARKS.high
    );

const makeCek = attribute => ({
    command: [`cek${attribute.key}`, `${attribute.key}cek`],
    help: [`cek${attribute.key} [@tag]`],
    tags: ["fun"],
    exec: (m, { sock }) => {
        const target = m.target || m.sender;
        const value = attribute.range
            ? randomInt(...attribute.range)
            : randomInt(0, 100);
        const display = attribute.unit
            ? `${value} ${attribute.unit}`
            : `${value}%`;
        const remark = attribute.unit ? "" : `\n${remarkFor(value)}`;
        return m.reply(
            `🔮 ${attribute.label} @${target.split("@")[0]}: *${display}*${remark}`,
            { mentions: [target] }
        );
    }
});

export default CEK_ATTRIBUTES.map(makeCek);
