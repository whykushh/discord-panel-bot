import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || 'data';
const FILE = path.join(DATA_DIR, 'commands.json');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function ensureCommandsShape() {
  ensureDir(DATA_DIR);
  if (!existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify({ textCommands: [], slashCommands: [] }, null, 2));
  } else {
    try {
      const obj = JSON.parse(readFileSync(FILE, 'utf8'));
      if (!obj.textCommands) obj.textCommands = [];
      if (!obj.slashCommands) obj.slashCommands = [];
      writeFileSync(FILE, JSON.stringify(obj, null, 2));
    } catch {
      writeFileSync(FILE, JSON.stringify({ textCommands: [], slashCommands: [] }, null, 2));
    }
  }
}

export function load() {
  ensureCommandsShape();
  return JSON.parse(readFileSync(FILE, 'utf8'));
}

export function save(_ignored, data) {
  ensureCommandsShape();
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}
