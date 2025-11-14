import fs from 'node:fs/promises';
import path from 'node:path';

const CONFIG_PATH = path.join(process.cwd(), 'notion-pages.config.json');
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toPosix = (p) => p.split(path.sep).join('/');

const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
const fileCache = new Map();
const dirtyFiles = new Set();

const loadFile = async (relativePath) => {
  if (!fileCache.has(relativePath)) {
    const absolute = path.join(process.cwd(), relativePath);
    const content = await fs.readFile(absolute, 'utf8');
    fileCache.set(relativePath, content);
  }
  return fileCache.get(relativePath);
};

const saveChanges = async () => {
  for (const file of dirtyFiles) {
    const absolute = path.join(process.cwd(), file);
    await fs.writeFile(absolute, fileCache.get(file), 'utf8');
    console.log(`Updated ${file}`);
  }
};

for (const page of config.pages) {
  for (const file of page.files) {
    let content = await loadFile(file);
    const directory = path.dirname(file) || '.';
    const relativeTarget = toPosix(path.relative(directory, page.outputPath));
    const pattern = new RegExp(`${escapeRegExp(page.notionUrl)}(?:\\?pvs=\\d+)?`, 'g');
    if (pattern.test(content)) {
      content = content.replace(pattern, relativeTarget);
      fileCache.set(file, content);
      dirtyFiles.add(file);
    }
  }
}

await saveChanges();
