const searchInput = document.querySelector('[data-resource-search]');
const resourceItems = Array.from(document.querySelectorAll('[data-resource-item]'));
const resourceCards = Array.from(document.querySelectorAll('.resource-card'));
const noResults = document.querySelector('[data-no-results]');
const yearEl = document.getElementById('year');
const glossarySearchInput = document.querySelector('[data-glossary-search]');
const glossaryItems = Array.from(document.querySelectorAll('[data-glossary-item]'));
const glossaryEmpty = document.querySelector('[data-glossary-empty]');
const stateSection = document.querySelector('[data-able-states]');
const stateTabsWrapper = stateSection ? stateSection.querySelector('[data-state-tab-list]') : null;
const statePanelsWrapper = stateSection ? stateSection.querySelector('[data-state-panels]') : null;
const stateToggleButton = document.querySelector('[data-state-toggle]');
const stateToggleDefaultLabel = stateToggleButton ? stateToggleButton.textContent.trim() : '';
const stateToggleExpandedLabel = stateToggleButton
  ? stateToggleButton.getAttribute('data-expanded-label') || 'Hide state programs'
  : 'Hide state programs';
const ableStateData = Array.isArray(window.ABLE_STATE_DATA) ? window.ABLE_STATE_DATA : [];

// Site-wide search index
let siteSearchIndex = [];

if (stateToggleButton && stateToggleDefaultLabel) {
  stateToggleButton.textContent = stateToggleDefaultLabel;
}

// Load the site-wide search index
const loadSearchIndex = async () => {
  try {
    const response = await fetch('search-index.json');
    siteSearchIndex = await response.json();
  } catch (error) {
    console.warn('Could not load search index:', error);
  }
};

// Search across all pages
const searchSiteWide = (query) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return siteSearchIndex
    .map(page => {
      const score = page.content.split(normalized).length - 1;
      return { ...page, score };
    })
    .filter(page => page.score > 0)
    .sort((a, b) => b.score - a.score);
};

// Create search result cards for site-wide results
const createSearchResultCard = (page) => {
  const card = document.createElement('article');
  card.className = 'resource-card resource-card--search-result';

  const preview = page.preview ? page.preview.slice(0, 150) + '...' : '';

  card.innerHTML = `
    <p class="eyebrow">Page result</p>
    <h3><a href="${page.url}">${page.title || page.mainHeading}</a></h3>
    <p>${preview}</p>
    <a class="text-link" href="${page.url}">Visit this page &rarr;</a>
  `;

  return card;
};

const filterResources = (query) => {
  const normalized = query.trim().toLowerCase();

  // First, filter local resources on the page
  resourceCards.forEach((card) => {
    // Skip search result cards
    if (card.classList.contains('resource-card--search-result')) {
      return;
    }

    const items = Array.from(card.querySelectorAll('[data-resource-item]'));
    let cardVisible = false;

    items.forEach((item) => {
      const match = item.textContent.toLowerCase().includes(normalized);
      item.hidden = Boolean(normalized) && !match;
      if (!normalized || match) {
        cardVisible = true;
      }
    });

    card.classList.toggle('card--muted', Boolean(normalized) && !cardVisible);
  });

  const hasLocalResults = !normalized || resourceItems.some((item) => !item.hidden);

  // Remove any existing search result cards
  const existingSearchResults = document.querySelectorAll('.resource-card--search-result');
  existingSearchResults.forEach(card => card.remove());

  // If there's a search query, search across all pages
  if (normalized && siteSearchIndex.length > 0) {
    const siteResults = searchSiteWide(normalized);
    const resourceGrid = document.getElementById('resource-grid');

    if (resourceGrid && siteResults.length > 0) {
      // Add search results at the end
      siteResults.slice(0, 6).forEach(page => {
        // Don't show current page in results if we're on index
        if (page.url === 'index.html') return;

        const resultCard = createSearchResultCard(page);
        resourceGrid.appendChild(resultCard);
      });
    }
  }

  // Determine if we have any results (local or site-wide)
  const hasSiteResults = normalized ? searchSiteWide(normalized).length > 0 : false;
  const hasResults = !normalized || hasLocalResults || hasSiteResults;

  if (noResults) {
    noResults.hidden = hasResults;
  }
};

const filterGlossary = (query) => {
  const normalized = query.trim().toLowerCase();
  let matches = 0;

  glossaryItems.forEach((item) => {
    const term = (item.dataset.term || item.textContent || '').toLowerCase();
    const match = !normalized || term.includes(normalized);
    item.hidden = Boolean(normalized) && !match;
    if (match) {
      matches += 1;
    }
  });

  if (glossaryEmpty) {
    glossaryEmpty.hidden = matches > 0;
  }
};

if (searchInput) {
  // Load search index on page load
  loadSearchIndex();

  searchInput.addEventListener('input', (event) => {
    filterResources(event.target.value);
  });
}

if (glossarySearchInput) {
  glossarySearchInput.addEventListener('input', (event) => {
    filterGlossary(event.target.value);
  });
}

const formatStateText = (value, fallback = 'Not available yet') => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value) && value.length) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
      .join(', ');
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  return fallback;
};

const formatBooleanValue = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Not available yet';
};

const initStateTabs = () => {
  if (!stateSection || !stateTabsWrapper || !statePanelsWrapper || !ableStateData.length) {
    if (stateSection) {
      stateSection.setAttribute('hidden', '');
    }
    if (stateToggleButton) {
      stateToggleButton.hidden = true;
    }
    return;
  }

  const panelsById = {};

  ableStateData.forEach((state, index) => {
    const tabId = `state-tab-${state.code}`;
    const panelId = `state-panel-${state.code}`;

    const tabButton = document.createElement('button');
    tabButton.type = 'button';
    tabButton.className = 'state-tab';
    tabButton.setAttribute('role', 'tab');
    tabButton.id = tabId;
    tabButton.setAttribute('aria-controls', panelId);
    tabButton.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    tabButton.tabIndex = index === 0 ? 0 : -1;
    if (index === 0) {
      tabButton.classList.add('state-tab--active');
    }
    tabButton.innerHTML = `
      <img src="https://flagcdn.com/us-${state.code}.svg" alt="Flag of ${state.state}" loading="lazy" />
      <span>${state.state}</span>
    `;
    stateTabsWrapper.appendChild(tabButton);

    const panel = document.createElement('article');
    panel.className = 'state-panel';
    if (index === 0) {
      panel.classList.add('state-panel--active');
    } else {
      panel.hidden = true;
    }
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabId);

    const statusText = formatStateText(
      (state.status || []).filter((entry) => entry && entry !== '!'),
    );

    const info = [
      { label: 'Program status', value: statusText },
      { label: 'Account limit', value: formatStateText(state.accountLimit) },
      { label: 'Initial contribution', value: formatStateText(state.initialContribution) },
      { label: 'Minimum contribution', value: formatStateText(state.minContribution) },
      { label: 'Annual fee', value: formatStateText(state.annualFee) },
      { label: 'Debit card program', value: formatBooleanValue(state.debitCardProgram) },
      { label: 'State tax deduction', value: formatBooleanValue(state.stateTaxDeduction) },
      { label: 'Out-of-state access', value: formatBooleanValue(state.outOfState) },
    ];

    const infoHtml = info
      .map(
        (item) => `
        <div>
          <dt>${item.label}</dt>
          <dd>${item.value}</dd>
        </div>
      `,
      )
      .join('');

    const linkHtml = state.link
      ? `<a class="state-panel__cta" href="${state.link}" target="_blank" rel="noreferrer noopener">Open program site ↗</a>`
      : '<span class="state-panel__cta">Program site not yet available</span>';

    panel.innerHTML = `
      <div class="state-panel__heading">
        <h3>${state.state}</h3>
        ${linkHtml}
      </div>
      <dl class="state-panel__grid">
        ${infoHtml}
      </dl>
    `;

    statePanelsWrapper.appendChild(panel);
    panelsById[panelId] = panel;
  });

  const tabs = Array.from(stateTabsWrapper.querySelectorAll('[role=\"tab\"]'));

  const activateTab = (nextTab) => {
    tabs.forEach((tab) => {
      const isActive = tab === nextTab;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.classList.toggle('state-tab--active', isActive);
      tab.tabIndex = isActive ? 0 : -1;
      const panelId = tab.getAttribute('aria-controls');
      const panel = panelsById[panelId];
      if (panel) {
        panel.hidden = !isActive;
        panel.classList.toggle('state-panel--active', isActive);
      }
    });
    nextTab.focus();
  };

  stateTabsWrapper.addEventListener('click', (event) => {
    const tab = event.target.closest('[role=\"tab\"]');
    if (!tab) return;
    activateTab(tab);
  });

  stateTabsWrapper.addEventListener('keydown', (event) => {
    const currentIndex = Math.max(0, tabs.indexOf(document.activeElement));
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextTab = tabs[(currentIndex + 1) % tabs.length];
      activateTab(nextTab);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const nextTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
      activateTab(nextTab);
    } else if (event.key === 'Home') {
      event.preventDefault();
      activateTab(tabs[0]);
    } else if (event.key === 'End') {
      event.preventDefault();
      activateTab(tabs[tabs.length - 1]);
    }
  });
};

if (stateSection) {
  initStateTabs();
}

if (stateToggleButton && stateSection) {
  stateToggleButton.addEventListener('click', () => {
    const isHidden = stateSection.hasAttribute('hidden');
    if (isHidden) {
      stateSection.removeAttribute('hidden');
      stateToggleButton.setAttribute('aria-expanded', 'true');
      stateToggleButton.textContent = stateToggleExpandedLabel;
      stateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      stateSection.setAttribute('hidden', '');
      stateToggleButton.setAttribute('aria-expanded', 'false');
      stateToggleButton.textContent = stateToggleDefaultLabel;
    }
  });
}

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// Medicaid Accordion functionality
const initAccordion = () => {
  const accordionButtons = document.querySelectorAll('.accordion-button');

  accordionButtons.forEach(button => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;
      const content = document.getElementById(section);
      const icon = button.querySelector('.accordion-icon');
      const isOpen = content.classList.contains('accordion-content--open');

      // Close all other accordions
      document.querySelectorAll('.accordion-content').forEach(item => {
        if (item !== content) {
          item.classList.remove('accordion-content--open');
        }
      });

      document.querySelectorAll('.accordion-button').forEach(btn => {
        if (btn !== button) {
          const btnIcon = btn.querySelector('.accordion-icon');
          btn.classList.remove('accordion-button--active');
          btn.setAttribute('aria-expanded', 'false');
          if (btnIcon) btnIcon.textContent = '+';
        }
      });

      // Toggle current accordion
      if (isOpen) {
        content.classList.remove('accordion-content--open');
        button.classList.remove('accordion-button--active');
        button.setAttribute('aria-expanded', 'false');
        if (icon) icon.textContent = '+';
      } else {
        content.classList.add('accordion-content--open');
        button.classList.add('accordion-button--active');
        button.setAttribute('aria-expanded', 'true');
        if (icon) icon.textContent = '−';
      }
    });
  });
};

// Initialize accordion if on medicaid page
if (document.querySelector('.medicaid-accordion')) {
  initAccordion();
}

// ============================================
// STATE ACCORDIONS - Medicaid & ADAP
// ============================================

// Initialize Medicaid state accordions
function initMedicaidStateAccordions() {
  const container = document.getElementById('medicaid-state-accordion');
  if (!container || typeof medicaidStateData === 'undefined') return;

  medicaidStateData.forEach((state, index) => {
    const details = document.createElement('details');
    details.className = 'state-accordion__item';

    const summary = document.createElement('summary');
    summary.className = 'state-accordion__header';
    summary.innerHTML = `
      <img src="${state.flag}" alt="${state.state} flag" class="state-accordion__flag" />
      <span class="state-accordion__name">${state.state}</span>
      <span class="state-accordion__icon" aria-hidden="true">+</span>
    `;

    const content = document.createElement('div');
    content.className = 'state-accordion__content';

    let contentHTML = '';

    // Eligibility section
    if (state.eligibility) {
      contentHTML += '<div class="state-accordion__section">';
      contentHTML += '<h4>Eligibility</h4>';
      if (state.eligibility.description) {
        contentHTML += `<p>${state.eligibility.description}</p>`;
      }
      if (state.eligibility.categories && state.eligibility.categories.length > 0) {
        contentHTML += '<p><strong>Eligible categories:</strong></p><ul>';
        state.eligibility.categories.forEach(cat => {
          contentHTML += `<li>${cat}</li>`;
        });
        contentHTML += '</ul>';
      }
      contentHTML += '</div>';
    }

    // Waivers section
    if (state.waiversDescription || state.waiverPrograms) {
      contentHTML += '<div class="state-accordion__section">';
      contentHTML += '<h4>Home & Community Based Waivers</h4>';
      if (state.waiversDescription) {
        contentHTML += `<p>${state.waiversDescription}</p>`;
      }
      if (state.waiverPrograms && state.waiverPrograms.length > 0) {
        contentHTML += '<ul>';
        state.waiverPrograms.forEach(program => {
          contentHTML += `<li><a href="${program.url}" target="_blank" rel="noreferrer noopener">${program.name}</a></li>`;
        });
        contentHTML += '</ul>';
      }
      contentHTML += '</div>';
    }

    // Nursing home allowance
    if (state.nursingHomePersonalAllowance) {
      contentHTML += '<div class="state-accordion__section">';
      contentHTML += '<h4>Nursing Home Personal Allowance</h4>';
      contentHTML += `<p>${state.nursingHomePersonalAllowance}</p>`;
      contentHTML += '</div>';
    }

    // More information link
    contentHTML += '<div class="state-accordion__section">';
    contentHTML += `<p><a href="notion-pages/medicaid/states/${state.state.toLowerCase().replace(/\s+/g, '-')}.html" target="_blank" rel="noreferrer noopener" class="state-accordion__link">View full ${state.state} Medicaid details →</a></p>`;
    contentHTML += '</div>';

    content.innerHTML = contentHTML;

    details.appendChild(summary);
    details.appendChild(content);
    container.appendChild(details);

    // Toggle icon on open/close
    details.addEventListener('toggle', () => {
      const icon = summary.querySelector('.state-accordion__icon');
      if (details.open) {
        icon.textContent = '−';
      } else {
        icon.textContent = '+';
      }
    });
  });
}

// Initialize ADAP state accordions
function initADAPStateAccordions() {
  const container = document.getElementById('adap-state-accordion');
  if (!container || typeof adapStateData === 'undefined') return;

  adapStateData.forEach((state, index) => {
    const details = document.createElement('details');
    details.className = 'state-accordion__item';

    const summary = document.createElement('summary');
    summary.className = 'state-accordion__header';
    summary.innerHTML = `
      <img src="${state.flag}" alt="${state.state} flag" class="state-accordion__flag" />
      <span class="state-accordion__name">${state.state}</span>
      <span class="state-accordion__icon" aria-hidden="true">+</span>
    `;

    const content = document.createElement('div');
    content.className = 'state-accordion__content';

    let contentHTML = '';

    // Eligibility section
    if (state.eligibility && state.eligibility.length > 0) {
      contentHTML += '<div class="state-accordion__section">';
      contentHTML += '<h4>Eligibility Requirements</h4>';
      contentHTML += '<div class="state-accordion__tags">';
      state.eligibility.forEach(req => {
        contentHTML += `<span class="state-accordion__tag">${req}</span>`;
      });
      contentHTML += '</div>';
      contentHTML += '</div>';
    }

    // Contact section
    if (state.contact) {
      contentHTML += '<div class="state-accordion__section">';
      contentHTML += '<h4>Contact Information</h4>';

      if (state.contact.address) {
        contentHTML += `<p><strong>Address:</strong><br>${state.contact.address}</p>`;
      }
      if (state.contact.phone) {
        contentHTML += `<p><strong>Phone:</strong> <a href="tel:${state.contact.phone.replace(/[^0-9]/g, '')}">${state.contact.phone}</a></p>`;
      }
      if (state.contact.fax) {
        contentHTML += `<p><strong>Fax:</strong> ${state.contact.fax}</p>`;
      }
      if (state.contact.email) {
        contentHTML += `<p><strong>Email:</strong> <a href="mailto:${state.contact.email}">${state.contact.email}</a></p>`;
      }
      contentHTML += '</div>';
    }

    // Application section
    if (state.applicationLink || state.onlineForm) {
      contentHTML += '<div class="state-accordion__section">';
      contentHTML += '<h4>Apply</h4>';
      if (state.onlineForm) {
        contentHTML += `<p><a href="${state.onlineForm}" target="_blank" rel="noreferrer noopener" class="button">Apply Online</a></p>`;
      }
      if (state.applicationLink && state.applicationLink !== state.onlineForm) {
        contentHTML += `<p><a href="${state.applicationLink}" target="_blank" rel="noreferrer noopener">Download Application</a></p>`;
      }
      contentHTML += '</div>';
    }

    // Program website
    if (state.programLink) {
      contentHTML += '<div class="state-accordion__section">';
      contentHTML += `<p><a href="${state.programLink}" target="_blank" rel="noreferrer noopener" class="state-accordion__link">Visit ${state.state} ADAP Program Website →</a></p>`;
      contentHTML += '</div>';
    }

    content.innerHTML = contentHTML;

    details.appendChild(summary);
    details.appendChild(content);
    container.appendChild(details);

    // Toggle icon on open/close
    details.addEventListener('toggle', () => {
      const icon = summary.querySelector('.state-accordion__icon');
      if (details.open) {
        icon.textContent = '−';
      } else {
        icon.textContent = '+';
      }
    });
  });
}

// Initialize state accordions when DOM is ready
if (document.getElementById('medicaid-state-accordion')) {
  initMedicaidStateAccordions();
}

if (document.getElementById('adap-state-accordion')) {
  initADAPStateAccordions();
}
