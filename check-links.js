const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const glob = require('glob');

// --- Configuration ---
// The base URL of your site (for resolving relative links)
// Change this to your local development server or live site URL.
const BASE_URL = 'http://127.0.0.1:5500'; // Example for VS Code Live Server

// The pattern to find HTML files in your project.
const FILE_PATTERN = '**/*.html';

// --- End Configuration ---

const checkedLinks = new Map();

/**
 * Checks if a URL is valid and returns its status.
 * Caches results to avoid re-checking the same URL.
 * @param {string} url The URL to check.
 * @returns {Promise<{status: number, statusText: string}|null>}
 */
async function checkUrl(url) {
  if (checkedLinks.has(url)) {
    return checkedLinks.get(url);
  }

  try {
    // Using a HEAD request is more efficient as it doesn't download the body.
    const response = await axios.head(url, {
      headers: {
        'User-Agent': 'BrokenLinkChecker/1.0',
      },
      timeout: 5000, // 5-second timeout
    });
    const result = { status: response.status, statusText: response.statusText };
    checkedLinks.set(url, result);
    return result;
  } catch (error) {
    let result;
    if (error.response) {
      result = { status: error.response.status, statusText: error.response.statusText };
    } else {
      result = { status: 0, statusText: error.message }; // Network error, timeout, etc.
    }
    checkedLinks.set(url, result);
    return result;
  }
}

async function main() {
  console.log(`Scanning for HTML files using pattern: ${FILE_PATTERN}`);
  const files = glob.sync(FILE_PATTERN, { ignore: 'node_modules/**' });

  if (files.length === 0) {
    console.log('No HTML files found. Check your FILE_PATTERN in the script.');
    return;
  }

  console.log(`Found ${files.length} HTML files to check.`);
  let brokenLinksCount = 0;

  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    const dom = new JSDOM(html);
    const links = dom.window.document.querySelectorAll('a[href]');

    for (const link of links) {
      let href = link.getAttribute('href');

      // Ignore empty, anchor, or mailto links
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue;
      }

      const url = new URL(href, BASE_URL).href;
      const result = await checkUrl(url);

      if (result.status >= 400 || result.status === 0) {
        brokenLinksCount++;
        console.error(`\n[BROKEN] ${url} (Status: ${result.status} ${result.statusText})`);
        console.error(`   └── Found in: ${file}`);
      } else {
        process.stdout.write('.'); // Show progress for valid links
      }
    }
  }

  console.log('\n\n--- Scan Complete ---');
  if (brokenLinksCount > 0) {
    console.log(`Found ${brokenLinksCount} broken link(s).`);
  } else {
    console.log('Congratulations! No broken links found.');
  }
  console.log(`Checked ${checkedLinks.size} unique URLs.`);
}

main().catch(console.error);