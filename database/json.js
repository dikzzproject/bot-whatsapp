import fs from "node:fs";
import path from "node:path";
import log from "#logger";

export default class JsonStore {
    constructor(file, defaults = {}) {
        this.file = file;
        this.defaults = defaults;
        this.snapshot = null;
        this.data = this.load();
    }

    load() {
        try {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            if (!fs.existsSync(this.file)) return structuredClone(this.defaults);
            
            const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
            return { ...structuredClone(this.defaults), ...raw };
        } catch (error) {
            if (fs.existsSync(this.file)) {
                const backup = `${this.file}.corrupt-${Date.now()}`;
                try {
                    fs.copyFileSync(this.file, backup);
                    log.error("database", `File ${path.basename(this.file)} is corrupted. Backup created: ${backup}`, error);
                } catch (backupError) {
                    log.error("database", `Failed to create backup for corrupted file ${path.basename(this.file)}`, backupError);
                }
            } else {
                log.error("database", `Failed to load ${path.basename(this.file)}`, error);
            }
            return structuredClone(this.defaults);
        }
    }

    save() {
        try {
            const serialized = JSON.stringify(this.data, null, 2);
            if (serialized === this.snapshot) return false;
            
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            
            // Menggunakan nama fail sementara yang unik untuk mengelakkan konflik
            const temp = `${this.file}.${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
            
            fs.writeFileSync(temp, serialized, "utf8");
            fs.renameSync(temp, this.file);
            
            this.snapshot = serialized;
            return true;
        } catch (error) {
            log.error("database", `Failed to save ${path.basename(this.file)}`, error);
            return false;
        }
    }
}
