import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const ensureDataFiles = () => {
  if (!existsSync('data')) mkdirSync('data');
  if (!existsSync('data/commands.json')) writeFileSync('data/commands.json', JSON.stringify({ commands: [] }, null, 2));
  if (!existsSync('data/embeds.json')) writeFileSync('data/embeds.json', JSON.stringify({ embeds: [] }, null, 2));
};

export const load = (file) => {
  ensureDataFiles();
  return JSON.parse(readFileSync(`data/${file}`, 'utf8'));
};

export const save = (file, data) => {
  ensureDataFiles();
  writeFileSync(`data/${file}`, JSON.stringify(data, null, 2));
};
