import fs from "node:fs";
import path from "node:path";
import config from "#config/global.js";
import { pickRandom } from "./utils.js";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export const listImages = (dir = config.paths.mediaImage) => {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter(file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
        .map(file => path.join(dir, file));
};

export const randomImage = (dir = config.paths.mediaImage) => {
    const files = listImages(dir);
    return files.length ? fs.readFileSync(pickRandom(files)) : null;
};

export const defaultAvatar = () => {
    const file = path.join(config.paths.mediaDefault, "avatar.jpg");
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
};
