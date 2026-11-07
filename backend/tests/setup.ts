// Runs before every test file: send all advisor files to a throw-away folder so tests never touch real data.
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "udyam-advisor-test-"));
process.env.ADVISOR_SESSIONS_FILE = path.join(dir, "advisor_sessions.json");
process.env.CALLBACKS_FILE = path.join(dir, "callbacks.json");
