import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const RG_CMD = "rg -o 'https://npickett7\\.notion\\.site/[A-Za-z0-9%-]+' -n";
let output = '';
try {
  output = execSync(`bash -lc "${RG_CMD}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
} catch (err) {
  output = err.stdout?.toString() ?? '';
}
const lines = output.trim().split(/\n+/).filter(Boolean);
const stateNames = new Set([
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut','delaware','district-of-columbia','florida','georgia','hawaii','idaho','illinois','indiana','iowa','kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan','minnesota','mississippi','missouri','montana','nebraska','nevada','new-hampshire','new-jersey','new-mexico','new-york','north-carolina','north-dakota','ohio','oklahoma','oregon','pennsylvania','puerto-rico','rhode-island','south-carolina','south-dakota','tennessee','texas','utah','vermont','virginia','washington','west-virginia','wisconsin','wyoming','american-samoa','guam','northern-mariana-islands','u.s.-virgin-islands','washington-d.c.','dc','puerto-rico','guam','federated-states-of-micronesia','palau','marshall-islands'
]);

const pageMap = new Map();

function toCanonicalId(rawId) {
  const cleaned = rawId.replace(/-/g, '');
  if (cleaned.length !== 32) return rawId;
  return `${cleaned.slice(0,8)}-${cleaned.slice(8,12)}-${cleaned.slice(12,16)}-${cleaned.slice(16,20)}-${cleaned.slice(20)}`;
}

function slugToFileName(slug) {
  return slug
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    || 'notion-page';
}

function inferCategory(files, slugName) {
  const normalizedSlug = slugName.replace(/\s+/g, '-').toLowerCase();
  const isState = stateNames.has(normalizedSlug);
  const priority = [
    { match: (file) => file.includes('adap'), category: isState ? 'adap/states' : 'adap' },
    { match: (file) => file.includes('medicaid'), category: isState ? 'medicaid/states' : 'medicaid' },
    { match: (file) => file.includes('disability') || file.includes('ssi') || file.includes('ssdi'), category: 'disability' },
    { match: (file) => file.includes('able'), category: 'able' },
    { match: (file) => file.includes('prescription') || file.includes('drug'), category: 'prescription' },
    { match: (file) => file.includes('medicare'), category: 'medicare' }
  ];
  for (const { match, category } of priority) {
    if (files.some((file) => match(file.toLowerCase()))) {
      return category;
    }
  }
  if (isState) return 'medicaid/states';
  return 'general';
}

for (const line of lines) {
  const firstColon = line.indexOf(':');
  const secondColon = line.indexOf(':', firstColon + 1);
  if (firstColon === -1 || secondColon === -1) continue;
  const filePath = line.slice(0, firstColon);
  if (filePath.startsWith('notion-pages/') || filePath === 'notion-pages.config.json') continue;
  const url = line.slice(secondColon + 1);
  const cleanUrl = url.split('?')[0];
  const match = cleanUrl.match(/([0-9a-f]{32})$/i);
  if (!match) continue;
  const rawId = match[1];
  const canonicalId = toCanonicalId(rawId);
  const slugPart = cleanUrl.slice(cleanUrl.lastIndexOf('/') + 1);
  const slugName = slugPart.replace(/-[0-9a-f]{32}$/i, '') || canonicalId;
  const fileSlug = slugToFileName(slugName);

  if (!pageMap.has(canonicalId)) {
    pageMap.set(canonicalId, {
      pageId: canonicalId,
      slug: slugName,
      notionUrl: cleanUrl,
      files: new Set([filePath])
    });
  } else {
    pageMap.get(canonicalId).files.add(filePath);
  }
}

const pages = Array.from(pageMap.values()).map((page) => {
  const files = Array.from(page.files);
  const category = inferCategory(files, page.slug);
  const outputPath = path.join('notion-pages', category, `${slugToFileName(page.slug)}.html`).replace(/\\/g, '/');
  return {
    pageId: page.pageId,
    slug: page.slug,
    notionUrl: page.notionUrl,
    files: files.sort(),
    outputPath
  };
});

await writeFile('notion-pages.config.json', JSON.stringify({ generatedAt: new Date().toISOString(), pages: pages.sort((a, b) => a.outputPath.localeCompare(b.outputPath)) }, null, 2));
console.log(`Wrote ${pages.length} page entries to notion-pages.config.json`);
