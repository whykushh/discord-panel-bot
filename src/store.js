import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const FILE = 'data/commands.json';

export function ensureCommandsShape() {
  if (!existsSync('data')) mkdirSync('data');
  if (!existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify({ textCommands: [], slashCommands: [] }, null, 2));
  } else {
    // migrate if old shape
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
  // keep a single file for commands now
  ensureCommandsShape();
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// older API compatibility (other imports use load('commands.json'))
export const load as loadFile = load;
export const save as saveFile = save;
export const load_compat = () => load();
export const save_compat = (file, data) => save(file, data);
