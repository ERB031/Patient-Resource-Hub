document.addEventListener('DOMContentLoaded', () => {
  const data = Array.isArray(window.SOC_LEARNING_MATERIALS)
    ? window.SOC_LEARNING_MATERIALS
    : [];
  const tableBody = document.getElementById('materials-body');
  const searchInput = document.getElementById('material-search');
  const typeFilter = document.getElementById('type-filter');
  const resultsCount = document.getElementById('results-count');
  const resetButton = document.getElementById('reset-filters');
  const sortButtons = document.querySelectorAll('.sort-button');
  const headerCells = document.querySelectorAll('th[data-sort-key]');

  const sorters = {
    resource: (item) => (item.name || '').toLowerCase(),
    type: (item) => (item.type || '').toLowerCase(),
    topics: (item) => (item.subjects || []).join(' ').toLowerCase(),
  };

  const sortState = {
    key: null,
    direction: 'asc',
  };

  const uniqueTypes = [...new Set(data.map((item) => item.type).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );

  if (typeFilter) {
    uniqueTypes.forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      typeFilter.append(option);
    });
  }

  function formatType(type) {
    return type && type.trim().length ? type : 'Uncategorized';
  }

  function createTopicsCell(subjects) {
    const fragment = document.createDocumentFragment();
    if (!subjects || !subjects.length) {
      const span = document.createElement('span');
      span.className = 'material-chip material-chip--muted';
      span.textContent = 'Not tagged';
      fragment.append(span);
      return fragment;
    }

    subjects.forEach((subject) => {
      const chip = document.createElement('span');
      chip.className = 'material-chip';
      chip.textContent = subject;
      fragment.append(chip);
    });
    return fragment;
  }

  function renderTable() {
    if (!tableBody) {
      return;
    }

    const query = (searchInput?.value || '').trim().toLowerCase();
    const typeValue = typeFilter?.value || '';

    const filtered = data.filter((item) => {
      const matchesType = !typeValue || item.type === typeValue;
      const haystack = [
        item.name || '',
        item.type || '',
        ...(item.subjects || []),
      ]
        .join(' ')
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesType && matchesQuery;
    });

    let sorted = filtered;
    if (sortState.key && sorters[sortState.key]) {
      sorted = [...filtered].sort((a, b) => {
        const aVal = sorters[sortState.key](a);
        const bVal = sorters[sortState.key](b);
        const comparison = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
        return sortState.direction === 'asc' ? comparison : -comparison;
      });
    }

    if (resultsCount) {
      resultsCount.textContent = `Showing ${filtered.length} ${
        filtered.length === 1 ? 'resource' : 'resources'
      }`;
    }

    tableBody.innerHTML = '';

    if (!sorted.length) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 3;
      emptyCell.textContent = 'No resources match your filters yet.';
      emptyRow.append(emptyCell);
      tableBody.append(emptyRow);
      return;
    }

    sorted.forEach((item) => {
      const row = document.createElement('tr');

      const resourceCell = document.createElement('td');
      if (item.link) {
        const link = document.createElement('a');
        link.href = item.link;
        link.target = '_blank';
        link.rel = 'noreferrer noopener';
        link.textContent = item.name || 'Untitled resource';
        resourceCell.append(link);
      } else {
        resourceCell.textContent = item.name || 'Untitled resource';
      }
      resourceCell.dataset.label = 'Resource';

      const typeCell = document.createElement('td');
      typeCell.textContent = formatType(item.type);
      typeCell.dataset.label = 'Type';

      const topicsCell = document.createElement('td');
      topicsCell.dataset.label = 'Topics';
      topicsCell.append(createTopicsCell(item.subjects));

      row.append(resourceCell, typeCell, topicsCell);
      tableBody.append(row);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderTable);
  }
  if (typeFilter) {
    typeFilter.addEventListener('change', renderTable);
  }
  function updateSortIndicators() {
    headerCells.forEach((cell) => {
      const key = cell.dataset.sortKey;
      if (sortState.key === key) {
        cell.setAttribute('aria-sort', sortState.direction === 'asc' ? 'ascending' : 'descending');
      } else {
        cell.setAttribute('aria-sort', 'none');
      }
    });

    sortButtons.forEach((button) => {
      const key = button.dataset.sortKey;
      if (sortState.key === key) {
        button.dataset.sortDirection = sortState.direction;
        const icon = button.querySelector('.sort-icon');
        if (icon) {
          icon.textContent = sortState.direction === 'asc' ? '↑' : '↓';
        }
      } else {
        button.dataset.sortDirection = '';
        const icon = button.querySelector('.sort-icon');
        if (icon) {
          icon.textContent = '↕';
        }
      }
    });
  }

  sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.sortKey;
      if (!key) return;
      if (sortState.key === key) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.key = key;
        sortState.direction = 'asc';
      }
      updateSortIndicators();
      renderTable();
    });
  });

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
      }
      if (typeFilter) {
        typeFilter.value = '';
      }
      sortState.key = null;
      sortState.direction = 'asc';
      updateSortIndicators();
      renderTable();
      searchInput?.focus();
    });
  }

  updateSortIndicators();
  renderTable();
});
