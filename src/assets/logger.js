import chalk from "chalk";
import moment from "moment-timezone";
import util from "node:util";

const TAGS = {
    info: chalk.bold.white.bgCyan,
    success: chalk.bold.white.bgGreen,
    warn: chalk.bold.white.bgYellow,
    error: chalk.bold.white.bgRed,
    debug: chalk.bold.white.bgMagenta,
    log: chalk.bold.white.bgBlue,
    msg: chalk.bold.white.bgGreen,
    cmd: chalk.bold.white.bgBlack
};

const stamp = () =>
    chalk.dim(moment().tz(config.bot.timezone).format("DD MMM YYYY, hh:mm:ss A"));

const stringify = value => {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === "string") return value;
    return util.inspect(value, { depth: 3, breakLength: 100 });
};

const write = (level, label, message, ...extra) => {
    const tag = TAGS[level](` ${String(label ?? level).toUpperCase()} `);
    const lines = [message, ...extra]
        .filter(item => item !== undefined && item !== "")
        .map(stringify);
    console.log(`${tag} ${stamp()}\n${lines.join("\n") || "No information"}\n`);
};

const logger = {
    info: (label, message, ...extra) => write("info", label, message, ...extra),
    success: (label, message, ...extra) => write("success", label, message, ...extra),
    warn: (label, message, ...extra) => write("warn", label, message, ...extra),
    error: (label, message, ...extra) => write("error", label, message, ...extra),
    log: (label, message, ...extra) => write("log", label, message, ...extra),
    msg: (label, message, ...extra) => write("msg", label, message, ...extra),
    cmd: (label, message, ...extra) => write("cmd", label, message, ...extra),
    debug: (label, message, ...extra) => {
        if (config.bot.debug) write("debug", label, message, ...extra);
    }
};

export default logger;
global.log = logger;
