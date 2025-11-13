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

if (stateToggleButton && stateToggleDefaultLabel) {
  stateToggleButton.textContent = stateToggleDefaultLabel;
}

const filterResources = (query) => {
  const normalized = query.trim().toLowerCase();

  resourceCards.forEach((card) => {
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

  const hasResults = !normalized || resourceItems.some((item) => !item.hidden);
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
