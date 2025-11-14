import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const NOTION_DIR = path.join(ROOT, 'notion-pages');

const walk = async (dir, matcher = () => true, skip = () => false) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (skip(fullPath, entry)) continue;
    if (entry.isDirectory()) {
      results.push(...(await walk(fullPath, matcher, skip)));
    } else if (matcher(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
};

const htmlFiles = await walk(NOTION_DIR, (file) => file.endsWith('.html'));
const pages = [];

const notionRegex = /https:\/\/npickett7\.notion\.site\/[A-Za-z0-9%-]+/;
const idRegex = /([0-9a-f]{32})$/i;

for (const file of htmlFiles) {
  const content = await fs.readFile(file, 'utf8');
  const match = content.match(notionRegex);
  if (!match) continue;
  const url = match[0];
  const idMatch = url.match(idRegex);
  if (!idMatch) continue;
  const rawId = idMatch[1];
  const canonicalId = `${rawId.slice(0,8)}-${rawId.slice(8,12)}-${rawId.slice(12,16)}-${rawId.slice(16,20)}-${rawId.slice(20)}`;
  const slugPart = url.slice(url.lastIndexOf('/') + 1).replace(/-[0-9a-f]{32}$/i, '');
  const outputPath = path.relative(ROOT, file).replace(/\\/g, '/');
  pages.push({ pageId: canonicalId, slug: slugPart || canonicalId, notionUrl: url, outputPath, files: [] });
}

const pageMap = new Map(pages.map((page) => [page.outputPath, page]));

const skipDirs = new Set(['notion-pages', 'scripts', '.git', 'images']);
const allFiles = await walk(ROOT, () => true, (fullPath, entry) => {
  if (entry.isDirectory()) {
    return skipDirs.has(entry.name);
  }
  return false;
});

const linkRegex = /["']([^"']*notion-pages[^"']*?\.html)["']/g;

for (const file of allFiles) {
  if (!file.endsWith('.html') && !file.endsWith('.json') && !file.endsWith('.js')) continue;
  if (file.includes('notion-pages/')) continue;
  const relFile = path.relative(ROOT, file).replace(/\\/g, '/');
  const dir = path.dirname(relFile);
  const content = await fs.readFile(file, 'utf8');
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const rawPath = match[1];
    const resolved = path.relative(ROOT, path.join(ROOT, dir, rawPath)).replace(/\\/g, '/');
    const normalized = resolved.replace(/\.\//g, '').replace(/\/+/, '/');
    const page = pageMap.get(normalized);
    if (page && !page.files.includes(relFile)) {
      page.files.push(relFile);
    }
  }
}

pages.sort((a, b) => a.outputPath.localeCompare(b.outputPath));
for (const page of pages) {
  page.files.sort();
}

await fs.writeFile('notion-pages.config.json', JSON.stringify({ generatedAt: new Date().toISOString(), pages }, null, 2));
console.log(`Rebuilt config with ${pages.length} entries`);
