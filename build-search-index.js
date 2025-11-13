const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Pages to index - add all your HTML pages here
const pagesToIndex = [
  'index.html',
  'glossary.html',
  'disability-benefits.html',
  'medicare.html',
  'medicaid.html',
  'able-accounts.html',
  'prescription-drug-savings.html',
  'standard-of-care.html',
  'ssdi-eligibility.html',
  'ssi-eligibility.html',
  'ssi-eligibility-for-children.html',
  'disability-determination-for-adults.html',
  'ssi-ssdi-differences.html',
  'reporting-to-ssa.html',
  'healthcare-while-incarcerated.html'
];

const searchIndex = [];

// Function to extract text content from HTML
function extractPageContent(htmlPath) {
  try {
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Get page title
    const title = document.querySelector('title')?.textContent || '';

    // Get main heading
    const mainHeading = document.querySelector('h1')?.textContent || '';

    // Get all headings for better search
    const headings = Array.from(document.querySelectorAll('h2, h3'))
      .map(h => h.textContent.trim())
      .join(' ');

    // Get all paragraph text
    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .join(' ');

    // Get all list items
    const listItems = Array.from(document.querySelectorAll('li'))
      .map(li => li.textContent.trim())
      .join(' ');

    // Get eyebrow/category text
    const eyebrows = Array.from(document.querySelectorAll('.eyebrow'))
      .map(e => e.textContent.trim())
      .join(' ');

    // Combine all text
    const fullText = `${title} ${mainHeading} ${headings} ${paragraphs} ${listItems} ${eyebrows}`;

    return {
      url: path.basename(htmlPath),
      title: title.replace(' · Patient Resource Hub', '').trim() || mainHeading,
      mainHeading,
      content: fullText.toLowerCase().replace(/\s+/g, ' ').trim(),
      preview: paragraphs.slice(0, 200) // First 200 chars for preview
    };
  } catch (error) {
    console.error(`Error processing ${htmlPath}:`, error.message);
    return null;
  }
}

// Build the index
console.log('Building search index...');
pagesToIndex.forEach(page => {
  const fullPath = path.join(__dirname, page);
  if (fs.existsSync(fullPath)) {
    const pageData = extractPageContent(fullPath);
    if (pageData) {
      searchIndex.push(pageData);
      console.log(`✓ Indexed: ${page}`);
    }
  } else {
    console.log(`⚠ Skipped (not found): ${page}`);
  }
});

// Write the index to a JSON file
const outputPath = path.join(__dirname, 'search-index.json');
fs.writeFileSync(outputPath, JSON.stringify(searchIndex, null, 2));
console.log(`\n✓ Search index created: ${outputPath}`);
console.log(`✓ Total pages indexed: ${searchIndex.length}`);
