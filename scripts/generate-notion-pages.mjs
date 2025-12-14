import fs from 'node:fs/promises';
import path from 'node:path';

const CONFIG_PATH = path.join(process.cwd(), 'notion-pages.config.json');
const NOTION_API = 'https://www.notion.so/api/v3/loadPageChunk';
const toPosix = (p) => p.split(path.sep).join('/');

const escapeHtml = (str = '') =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const annotationHandlers = {
  b: (text) => `<strong>${text}</strong>`,
  i: (text) => `<em>${text}</em>`,
  u: (text) => `<span class="notion-underline">${text}</span>`,
  s: (text) => `<span class="notion-strikethrough">${text}</span>`,
  code: (text) => `<code>${text}</code>`
};

function renderRichText(fragments = []) {
  return fragments
    .map(([text, annotations = []]) => {
      let result = escapeHtml(text);
      for (const annotation of annotations) {
        const [type, value] = annotation;
        if (type === 'a') {
          result = `<a href="${escapeHtml(value)}" target="_blank" rel="noreferrer noopener">${result}</a>`;
        } else if (type === 'c') {
          result = `<span class="notion-color notion-color--${value}">${result}</span>`;
        } else if (type === 'e') {
          const trimmed = result.trim();
          if (trimmed.startsWith('^')) {
            result = `<sup>${escapeHtml(trimmed.slice(1))}</sup>`;
          } else {
            result = `<span class="notion-equation" data-equation="${escapeHtml(value || trimmed)}">${result}</span>`;
          }
        } else if (annotationHandlers[type]) {
          result = annotationHandlers[type](result);
        }
      }
      return result;
    })
    .join('');
}

const getText = (block) => {
  const prop = block.properties?.title || block.properties?.caption;
  return renderRichText(prop || []);
};

function renderChildren(ids = [], ctx, withinList = false) {
  const html = [];
  let i = 0;
  while (i < ids.length) {
    const blockId = ids[i];
    const block = ctx.blocks[blockId]?.value;
    if (!block || block.alive === false) {
      i += 1;
      continue;
    }
    if (block.type === 'bulleted_list' || block.type === 'numbered_list') {
      const listTag = block.type === 'bulleted_list' ? 'ul' : 'ol';
      const items = [];
      while (i < ids.length && ctx.blocks[ids[i]]?.value?.type === block.type) {
        items.push(renderListItem(ids[i], ctx));
        i += 1;
      }
      html.push(`<${listTag}>${items.join('')}</${listTag}>`);
      continue;
    }
    html.push(renderBlock(block, ctx));
    i += 1;
  }
  return withinList ? html.join('') : html.join('\n');
}

function renderListItem(blockId, ctx) {
  const block = ctx.blocks[blockId]?.value;
  if (!block) return '';
  const text = getText(block);
  const children = block.content ? renderChildren(block.content, ctx, true) : '';
  return `<li>${text}${children ? `<div class="notion-list-children">${children}</div>` : ''}</li>`;
}

function renderToggle(block, ctx) {
  const summary = getText(block);
  const children = block.content ? renderChildren(block.content, ctx) : '';
  return `<details class="notion-toggle"><summary>${summary}</summary>${children}</details>`;
}

function renderColumns(block, ctx) {
  const columns = (block.content || []).map((columnId) => {
    const columnBlock = ctx.blocks[columnId]?.value;
    if (!columnBlock) return '';
    const inner = columnBlock.content ? renderChildren(columnBlock.content, ctx) : '';
    return `<div class="notion-column">${inner}</div>`;
  });
  return `<div class="notion-columns">${columns.join('\n')}</div>`;
}

function renderCallout(block, ctx) {
  const icon = block.format?.page_icon ? `<span class="notion-callout__icon">${escapeHtml(block.format.page_icon)}</span>` : '';
  const text = getText(block);
  const children = block.content ? renderChildren(block.content, ctx) : '';
  const colorClass = block.format?.block_color ? ` notion-color-bg--${block.format.block_color}` : '';
  return `<div class="notion-callout${colorClass}">${icon}<div>${text}${children}</div></div>`;
}

const renderImage = (block) => {
  const source = block.format?.display_source || block.properties?.source?.[0]?.[0];
  if (!source) return '';
  const caption = block.properties?.caption ? `<figcaption>${renderRichText(block.properties.caption)}</figcaption>` : '';
  return `<figure class="notion-figure"><img src="${escapeHtml(source)}" alt="" loading="lazy" />${caption}</figure>`;
};

const renderBookmark = (block) => {
  const link = block.properties?.link?.[0]?.[0] || block.format?.bookmark_url || block.properties?.source?.[0]?.[0];
  if (!link) return '';
  const title = block.properties?.title ? renderRichText(block.properties.title) : escapeHtml(link);
  const desc = block.properties?.description ? `<p>${renderRichText(block.properties.description)}</p>` : '';
  return `<a class="notion-bookmark" href="${escapeHtml(link)}" target="_blank" rel="noreferrer noopener"><div><strong>${title}</strong>${desc}</div></a>`;
};

const renderEmbed = (block) => {
  const source = block.properties?.source?.[0]?.[0] || block.format?.display_source;
  if (!source) return '';
  return `<div class="notion-embed"><iframe src="${escapeHtml(source)}" loading="lazy" referrerpolicy="no-referrer"></iframe></div>`;
};

const renderVideo = (block) => {
  const source = block.properties?.source?.[0]?.[0] || block.format?.display_source;
  if (!source) return '';
  return `<div class="notion-video"><iframe src="${escapeHtml(source)}" loading="lazy" allowfullscreen></iframe></div>`;
};

function renderAlias(block, ctx, seen = new Set()) {
  const pointerId = block.format?.alias_pointer?.id;
  if (!pointerId || seen.has(pointerId)) return '';
  seen.add(pointerId);
  const target = ctx.blocks[pointerId]?.value;
  if (!target) return '';
  return renderBlock(target, ctx, seen);
}

function renderTransclusion(block, ctx) {
  const pointerId = block.format?.transclusion_reference?.pointer?.id;
  if (!pointerId) return '';
  const target = ctx.blocks[pointerId]?.value;
  if (!target) return '';
  return `<div class="notion-transclusion">${renderBlock(target, ctx)}</div>`;
}

function renderChildPage(block, ctx) {
  const title = getText(block) || 'Untitled';
  const children = block.content ? renderChildren(block.content, ctx) : '';
  return `<section class="notion-child-page"><h3>${title}</h3>${children}</section>`;
}

function renderCollectionPlaceholder(block) {
  const title = block.properties?.title ? renderRichText(block.properties.title) : 'Collection view';
  return `<div class="notion-collection-placeholder"><p>${title}</p><p><a href="#" onclick="return false;">Open this section in the Notion doc for full details.</a></p></div>`;
}

function renderBlock(block, ctx, seenAlias) {
  switch (block.type) {
    case 'text':
    case 'paragraph':
      return `<p>${getText(block)}</p>`;
    case 'heading_1':
    case 'page_title':
      return `<h2>${getText(block)}</h2>`;
    case 'heading_2':
    case 'sub_header':
      return `<h3>${getText(block)}</h3>`;
    case 'heading_3':
    case 'sub_sub_header':
      return `<h4>${getText(block)}</h4>`;
    case 'quote':
      return `<blockquote>${getText(block)}</blockquote>`;
    case 'callout':
      return renderCallout(block, ctx);
    case 'column_list':
      return renderColumns(block, ctx);
    case 'column':
      return block.content ? renderChildren(block.content, ctx) : '';
    case 'divider':
      return '<hr class="notion-divider" />';
    case 'toggle':
      return renderToggle(block, ctx);
    case 'to_do': {
      const checked = block.properties?.checked?.[0]?.[0] === 'Yes';
      return `<label class="notion-todo"><input type="checkbox" ${checked ? 'checked' : ''} disabled />${getText(block)}</label>`;
    }
    case 'code': {
      const lang = block.properties?.language?.[0]?.[0] || 'plain';
      return `<pre class="notion-code" data-lang="${escapeHtml(lang)}"><code>${getText(block)}</code></pre>`;
    }
    case 'image':
      return renderImage(block);
    case 'bookmark':
      return renderBookmark(block);
    case 'embed':
      return renderEmbed(block);
    case 'video':
      return renderVideo(block);
    case 'alias':
      return renderAlias(block, ctx, seenAlias || new Set());
    case 'transclusion_reference':
      return renderTransclusion(block, ctx);
    case 'page':
      return renderChildPage(block, ctx);
    case 'collection_view':
    case 'collection_view_page':
      return renderCollectionPlaceholder(block);
    case 'table':
    case 'table_row':
      return '';
    default:
      console.warn(`Unhandled block type: ${block.type}`);
      return `<p>${getText(block)}</p>`;
  }
}

function buildTemplate({ title, notionUrl, bodyHtml, outputPath }) {
  const outputDir = path.dirname(outputPath);
  const relStyles = toPosix(
    path.relative(outputDir, 'assets/css/styles.css') || 'assets/css/styles.css',
  );
  const relScript = toPosix(
    path.relative(outputDir, 'assets/js/script.js') || 'assets/js/script.js',
  );
  const relIndex = toPosix(path.relative(outputDir, 'index.html') || 'index.html');
  const relLogo = toPosix(path.relative(outputDir, 'images/Logo%20PRH.png'));
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escapeHtml(title)} · Patient Resource Hub</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${relStyles}" />
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <header class="hero hero--subpage" id="top">
      <nav class="nav">
        <div class="logo">
          <a href="${relIndex}" class="logo-link-wrapper">
            <img class="logo-mark" src="${relLogo}" alt="Patient Resource Hub logo" />
            <div>
              <p class="logo-eyebrow">Patient Resource Hub</p>
              <p class="logo-title">Resource Companion</p>
            </div>
          </a>
        </div>
        <div class="nav-actions">
          <a class="nav-link" href="${relIndex}#mission">Mission</a>
          <a class="nav-link" href="${relIndex}#resources">Resources</a>
          <a class="button button--ghost" href="https://forms.gle/bgS2vJRJADpwZJFY7" target="_blank" rel="noreferrer noopener">Submit a resource</a>
        </div>
      </nav>
      <div class="hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">Patient Resource Hub</p>
          <h1>${escapeHtml(title)}</h1>
          <p>This page mirrors our Notion doc so you can browse without leaving the site.</p>
          <div class="hero-ctas">
            <a class="button" href="${escapeHtml(notionUrl)}" target="_blank" rel="noreferrer noopener">View original Notion doc</a>
          </div>
        </div>
        <div class="hero-visual hero-visual--glossary" role="img" aria-label="Illustration inspired by Patient Resource Hub"></div>
      </div>
    </header>
    <main id="main-content">
      <section class="content-section">
        <div class="prose notion-prose">
          ${bodyHtml}
        </div>
      </section>
    </main>
    <script src="${relScript}" defer></script>
  </body>
</html>`;
}

async function fetchRecordMap(pageId) {
  let cursor = { stack: [] };
  let chunkNumber = 0;
  const recordMap = { block: {}, collection: {}, collection_view: {} };
  while (true) {
    const res = await fetch(NOTION_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pageId, limit: 100, chunkNumber, cursor, verticalColumns: false })
    });
    if (!res.ok) throw new Error(`Failed to load Notion chunk for ${pageId}: ${res.status}`);
    const data = await res.json();
    Object.assign(recordMap.block, data.recordMap?.block ?? {});
    Object.assign(recordMap.collection, data.recordMap?.collection ?? {});
    Object.assign(recordMap.collection_view, data.recordMap?.collection_view ?? {});
    if (!data.cursor?.stack?.length) break;
    cursor = data.cursor;
    chunkNumber += 1;
  }
  return recordMap;
}

async function generate() {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  const pageLookup = new Map(config.pages.map((page) => [page.pageId, page.outputPath]));
  for (const page of config.pages) {
    try {
      const recordMap = await fetchRecordMap(page.pageId);
      const root = recordMap.block[page.pageId]?.value;
      if (!root) {
        console.warn(`Missing root block for ${page.pageId}`);
        continue;
      }
      const ctx = {
        blocks: recordMap.block,
        recordMap,
        pageLookup,
        outputDir: path.dirname(page.outputPath)
      };
      const title = root.properties?.title?.[0]?.[0] || page.slug;
      const bodyHtml = renderChildren(root.content || [], ctx);
      const html = buildTemplate({ title, notionUrl: page.notionUrl, bodyHtml, outputPath: page.outputPath });
      const absoluteOutput = path.join(process.cwd(), page.outputPath);
      await fs.mkdir(path.dirname(absoluteOutput), { recursive: true });
      await fs.writeFile(absoluteOutput, html, 'utf8');
      console.log(`Generated ${page.outputPath}`);
    } catch (error) {
      console.error(`Failed to process ${page.notionUrl}: ${error.message}`);
    }
  }
}

generate();
