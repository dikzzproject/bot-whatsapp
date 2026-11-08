import fs from "node:fs";
import { spawn } from "node:child_process";
import { removeFile, tempPath } from "./utils.js";

export async function runFfmpeg(buffer, { inputExt = "bin", outputExt, args = [] }) {
    const input = tempPath(inputExt);
    const output = tempPath(outputExt);
    fs.writeFileSync(input, buffer);

    try {
        await new Promise((resolve, reject) => {
            const process = spawn("ffmpeg", ["-y", "-i", input, ...args, output], { stdio: "ignore" });
            process.on("error", () => reject(new Error("ffmpeg tidak dipasang pada pelayan.")));
            process.on("close", code => (code === 0 ? resolve() : reject(new Error(`ffmpeg gagal (kod ${code}).`))));
        });
        return fs.readFileSync(output);
    } finally {
        removeFile(input);
        removeFile(output);
    }
}

export const toMp3 = (buffer, inputExt = "mp4") =>
    runFfmpeg(buffer, { inputExt, outputExt: "mp3", args: ["-vn", "-acodec", "libmp3lame", "-ab", "128k"] });

export const toVoiceNote = (buffer, inputExt = "mp4") =>
    runFfmpeg(buffer, {
        inputExt,
        outputExt: "ogg",
        args: ["-vn", "-c:a", "libopus", "-b:a", "48k", "-vbr", "on", "-ar", "48000", "-ac", "1"]
    });

export const toPng = (buffer, inputExt = "webp") =>
    runFfmpeg(buffer, { inputExt, outputExt: "png", args: ["-frames:v", "1"] });
