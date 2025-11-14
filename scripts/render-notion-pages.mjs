#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { NotionAPI } from 'notion-client';
import { NotionRenderer } from 'react-notion-x';
import { Code } from 'react-notion-x/build/third-party/code';
import { Collection } from 'react-notion-x/build/third-party/collection';
import { Equation } from 'react-notion-x/build/third-party/equation';
import { Modal } from 'react-notion-x/build/third-party/modal';
import { Pdf } from 'react-notion-x/build/third-party/pdf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const configPath = path.join(rootDir, 'notion-pages.config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const notion = new NotionAPI();
const pageIdToPath = new Map();
const notionUrlToPath = new Map();

const normalizeUrl = (url) => {
  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();
    return `${parsed.protocol}//${host}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return url;
  }
};

const toCanonicalId = (rawId) => {
  const cleaned = rawId.replace(/-/g, '').toLowerCase();
  if (cleaned.length !== 32) return rawId.toLowerCase();
  return `${cleaned.slice(0, 8)}-${cleaned.slice(8, 12)}-${cleaned.slice(12, 16)}-${cleaned.slice(16, 20)}-${cleaned.slice(20)}`;
};

const relativeLink = (fromPath, toPath) => {
  const fromAbs = path.join(rootDir, path.dirname(fromPath));
  const toAbs = path.join(rootDir, toPath);
  const rel = path.relative(fromAbs, toAbs);
  return rel.replace(/\\/g, '/');
};

config.pages.forEach((page) => {
  const canonicalId = page.pageId.toLowerCase();
  pageIdToPath.set(canonicalId, page.outputPath);

  const normalized = normalizeUrl(page.notionUrl);
  notionUrlToPath.set(normalized, page.outputPath);
  if (normalized.includes('npickett7.notion.site')) {
    const alt = normalized.replace('npickett7.notion.site', 'www.notion.so');
    notionUrlToPath.set(alt, page.outputPath);
  } else if (normalized.includes('www.notion.so')) {
    const alt = normalized.replace('www.notion.so', 'npickett7.notion.site');
    notionUrlToPath.set(alt, page.outputPath);
  }
});

const rewriteNotionLinks = (html, outputPath) => {
  let updated = html.replace(/href="\/([0-9a-f]{32})"/gi, (match, rawId) => {
    const canonical = toCanonicalId(rawId);
    const target = pageIdToPath.get(canonical);
    if (!target) {
      return `href="https://www.notion.so/${rawId}"`;
    }
    return `href="${relativeLink(outputPath, target)}"`;
  });

  updated = updated.replace(/href="(https?:\/\/[^"']*notion[^"']*)"/gi, (match, url) => {
    const target = notionUrlToPath.get(normalizeUrl(url));
    if (!target) {
      return match;
    }
    return `href="${relativeLink(outputPath, target)}"`;
  });

  return updated;
};

const renderPage = async (pageConfig) => {
  const recordMap = await notion.getPage(pageConfig.pageId);
  const notionHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(NotionRenderer, {
      recordMap,
      fullPage: false,
      darkMode: false,
      components: {
        Code,
        Collection,
        Equation,
        Modal,
        Pdf
      }
    })
  );

  const rewrittenHtml = rewriteNotionLinks(notionHtml, pageConfig.outputPath);
  const unresolvedMatches = rewrittenHtml.match(/href="\/[0-9a-f]{32}"/gi);
  if (unresolvedMatches && unresolvedMatches.length) {
    console.warn(`Warning: ${unresolvedMatches.length} unresolved Notion links remain in ${pageConfig.outputPath}`);
  }

  const outputPath = path.join(rootDir, pageConfig.outputPath);
  let fileContents = await fs.readFile(outputPath, 'utf8');
  const markerRegex = /<div class="prose notion-prose">[\s\S]*?<\/div>/;

  if (!markerRegex.test(fileContents)) {
    throw new Error(`Could not find notion-prose container in ${pageConfig.outputPath}`);
  }

  fileContents = fileContents.replace(
    markerRegex,
    `<div class="prose notion-prose">\n          ${rewrittenHtml}\n        </div>`
  );
  fileContents = fileContents.replace(/href="\/([0-9a-f]{32})"/gi, (match, rawId) => {
    return `href="https://www.notion.so/${rawId}"`;
  });

  await fs.writeFile(outputPath, fileContents);
  return pageConfig.outputPath;
};

const main = async () => {
  const rendered = [];
  for (const pageConfig of config.pages) {
    try {
      const output = await renderPage(pageConfig);
      rendered.push(output);
      console.log(`Rendered ${output}`);
    } catch (error) {
      console.error(`Failed to render ${pageConfig.outputPath}:`, error.message);
      throw error;
    }
  }
  console.log(`Rendered ${rendered.length} Notion pages.`);
};

await main();
