import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import log from "#logger";

const ENTRY = path.resolve("main.js");
const MAX_CRASHES = 5;
const CRASH_WINDOW_MS = 60000;
const crashes = [];
let child = null;

const recordCrash = () => {
    const now = Date.now();
    crashes.push(now);
    while (crashes.length && now - crashes[0] > CRASH_WINDOW_MS)
        crashes.shift();
    return crashes.length;
};

const start = () => {
    const nodeArgs = fs.existsSync(".env") ? ["--env-file=.env"] : [];
    child = spawn(
        process.execPath,
        [...nodeArgs, ENTRY, ...process.argv.slice(2)],
        {
            stdio: ["inherit", "inherit", "inherit", "ipc"]
        }
    );

    child.on("message", message => {
        if (message === "reset") {
            log.log("supervisor", "Restart request accepted.");
            child.kill();
            start();
        }
        if (message === "uptime")
            child.send({ type: "uptime", value: process.uptime() });
    });

    child.on("exit", (code, signal) => {
        log.warn(
            "supervisor",
            `Process ended. Code: ${code} | Signal: ${signal ?? "null"}`
        );
        if (code === 0)
            return log.success("supervisor", "Process completed successfully.");
        if (recordCrash() >= MAX_CRASHES) {
            return log.error(
                "supervisor",
                `Crash ${MAX_CRASHES} times in a short time. Stopped.`
            );
        }
        log.log("supervisor", "Automatically restarting...");
        setTimeout(start, 2000);
    });

    child.on("error", error =>
        log.error("supervisor", "Failed to start child process", error)
    );
};

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child?.kill(signal));
}

start();
