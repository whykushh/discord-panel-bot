import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const FILE = 'data/commands.json';

export function ensureCommandsShape() {
  if (!existsSync('data')) mkdirSync('data');
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

export function save(_fileNameIgnored, data) {
  ensureCommandsShape();
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}
