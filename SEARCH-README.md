# Site-Wide Search Implementation

## Overview
The Patient Resource Hub now features a comprehensive site-wide search that allows users to search across all pages on the website from the main page search bar.

## How It Works

### Search Index
- All pages are indexed in `search-index.json`
- The index contains page titles, headings, content, and previews
- Search is performed client-side for instant results

### Features
- **Real-time search**: Results appear as you type
- **Site-wide coverage**: Searches across all 15+ pages
- **Smart ranking**: Pages with more matches appear first
- **Visual indicators**: Search results have a distinctive blue design with "Page result" label
- **Preview text**: Shows a snippet from each matching page

## Maintaining the Search Index

### When to Rebuild the Index
Rebuild the search index whenever you:
- Add new HTML pages
- Update content on existing pages
- Change page titles or headings
- Want search to reflect latest content

### How to Rebuild

1. **Update the page list** (if adding/removing pages):
   Edit `build-search-index.js` and update the `pagesToIndex` array:
   ```javascript
   const pagesToIndex = [
     'index.html',
     'new-page.html',  // Add your new page here
     // ... other pages
   ];
   ```

2. **Run the build script**:
   ```bash
   node build-search-index.js
   ```

3. **Verify the output**:
   - Check that `search-index.json` was updated
   - The script will show which pages were indexed

### File Structure
```
.
├── build-search-index.js     # Script to generate search index
├── search-index.json          # Generated search index (66KB)
├── assets/js/script.js         # Includes search functionality
├── index.html                 # Main page with search bar
└── assets/css/styles.css       # Includes search result styles
```

## Search Features

### For Users
- Type any keyword in the search bar on the home page
- See both:
  - Local results (resources visible on current page)
  - Site-wide results (pages that contain your search term)
- Click "Visit this page →" to navigate to full content

### Technical Details
- **Loading**: Search index loads asynchronously when page loads
- **Performance**: ~66KB index loads once and caches
- **Scoring**: Simple frequency-based scoring (more matches = higher rank)
- **Limit**: Shows top 6 site-wide results per search
- **Accessibility**: Proper ARIA labels and semantic HTML

## Customization

### Styling Search Results
Edit the `.resource-card--search-result` class in `assets/css/styles.css`:
```css
.resource-card--search-result {
  background: linear-gradient(145deg, #f0f5fd, #f6f9fd);
  border-left: 4px solid var(--accent-strong);
}
```

### Adjusting Search Behavior
In `assets/js/script.js`, you can modify:
- **Number of results**: Change `siteResults.slice(0, 6)` to show more/fewer
- **Scoring algorithm**: Modify the `searchSiteWide()` function
- **Preview length**: Adjust `page.preview.slice(0, 150)`

## Troubleshooting

### Search not working?
1. Check browser console for errors
2. Verify `search-index.json` exists and is valid JSON
3. Ensure `assets/js/script.js` is loaded (check Network tab)
4. Rebuild the search index with latest content

### Index file too large?
- Consider removing common words from index
- Shorten preview text in `build-search-index.js`
- Use compression on web server (gzip)

## Dependencies
- **jsdom** (dev): Used by build script to parse HTML
  ```bash
  npm install jsdom --save-dev
  ```

## Future Enhancements
- [ ] Add fuzzy matching for typos
- [ ] Highlight search terms in results
- [ ] Add category/type filtering
- [ ] Implement autocomplete suggestions
- [ ] Add search analytics tracking
