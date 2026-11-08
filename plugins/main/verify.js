export default {
    name: "verify-no-prefix",
    command: new RegExp,
    prefix: "@verify",
    help: ["@verify"],
    tags: ["main"],
    run: m => m.reply("✅ @verify diterima. Plugin ini berjalan tanpa awalan global dan tanpa before.")
};
