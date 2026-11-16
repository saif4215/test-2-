// Save a copy of the café's data right now:   npm run backup
// Copies go to <data folder>/backups/<date>/ (the newest 7 days are kept). The server also does this by itself every day.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { backupData } from "../lib/backup.mjs";
import { loadDotEnv } from "../lib/env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(ROOT);
const dir = process.env.DATA_DIR || path.join(ROOT, "data");
const r = backupData(dir);
console.log(r ? `Saved a copy of your data in ${r.dir}\nCopy that folder somewhere else (a USB stick, cloud drive) so one broken disk cannot take both.` : `No data found in ${dir} yet, so there is nothing to back up.`);
