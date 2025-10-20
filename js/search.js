import { ELASTICSEARCH_CONFIG, SEARCH_CONFIG, globalState } from './config.js';
import { escapeHtml, formatDate, showError } from './utils.js';
import { createAndSelectSession } from './session.js';


globalState.pageResultsRaw = []; 
globalState.resultsView = {
  sortKey: null,   
  sortDir: 'asc'  
};

function buildElasticsearchQuery(params, page) {
    const query = {
        query: {
            bool: {
                must: []
            }
        },
        size: SEARCH_CONFIG.PAGE_SIZE,
        sort: [
            { _score: { order: 'desc' } },
            { date: { order: 'desc' } }
        ],
        from: (Math.max(1, page) - 1) * SEARCH_CONFIG.PAGE_SIZE
    };

    if (params.searchText.trim()) {
        const fields = params.searchFields;
        const textQuery = {
            multi_match: {
                query: params.searchText,
                fields: fields,
                operator: params.operator,
                type: 'best_fields'
            }
        };
        query.query.bool.must.push(textQuery);
    }

    // Add date range filter if provided
    if (params.dateFrom || params.dateTo) {
        const dateRange = {};
        if (params.dateFrom) {
            dateRange.gte = params.dateFrom;
        }
        if (params.dateTo) {
            dateRange.lte = params.dateTo;
        }

        query.query.bool.filter = [
            {
                range: {
                    date: dateRange
                }
            }
        ];
    }

    // If no search text and no date filters, return all documents
    if (!params.searchText.trim() && !params.dateFrom && !params.dateTo) {
        query.query = { match_all: {} };
    }

    return query;
}

export async function performElasticsearchSearch(params, page) {
    globalState.hasElasticRequest = true;
    const query = buildElasticsearchQuery(params, page);
    
    const headers = {
        'Content-Type': 'application/json',
    };

    // Add Basic Auth header if credentials are provided in config
    if (ELASTICSEARCH_CONFIG.USERNAME && ELASTICSEARCH_CONFIG.PASSWORD) {
        headers['Authorization'] = 'Basic ' + btoa(`${ELASTICSEARCH_CONFIG.USERNAME}:${ELASTICSEARCH_CONFIG.PASSWORD}`);
    }

    const response = await fetch(`${ELASTICSEARCH_CONFIG.URL}/${ELASTICSEARCH_CONFIG.INDEX_NAME}/_search?size=${SEARCH_CONFIG.PAGE_SIZE}&from=${(page - 1) * SEARCH_CONFIG.PAGE_SIZE}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(query)
    });

    if (!response.ok) {
        throw new Error(`Elasticsearch request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    globalState.totalHits = (typeof data.hits.total === 'object') ? data.hits.total.value : (data.hits.total || 0);
    
    return data.hits.hits.map(hit => ({
        id: hit._id,
        subject: hit._source.subject || '',
        body: hit._source.body || '',
        sender: hit._source.sender || hit._source.from || '',
        to: hit._source.to || '',
        cc: hit._source.cc || '',
        date: hit._source.date || hit._source.timestamp || '',
    }));
}

export async function handleSearch(e) {
    e.preventDefault();
    
    const searchForm = document.getElementById('searchForm');
    const formData = new FormData(searchForm);
    const searchParams = {
        searchText: formData.get('searchText') || '',
        searchFields: Array.from(document.querySelectorAll('input[name="searchFields"]:checked')).map(cb => cb.value),
        operator: formData.get('operator') || SEARCH_CONFIG.DEFAULT_OPERATOR,
        dateFrom: formData.get('dateFrom') || '',
        dateTo: formData.get('dateTo') || ''
    };

    globalState.currentSearchParams = searchParams;
    globalState.currentPage = 1;
    
    try {
        const results = await performElasticsearchSearch(searchParams, globalState.currentPage);
        displaySearchResults(results);
        globalState.hasElasticRequest = true;

        const titleText = (searchParams.searchText || '').trim() || 'بدون متن';
        const title = `${titleText}`;
        await createAndSelectSession(title);
    } catch (error) {
        showError('جستجو ناموفق بود: ' + error.message);
    }
}

export function displaySearchResults(results) {
  globalState.resultsView.sortKey = null;
  globalState.resultsView.sortDir = 'asc';
  globalState.pageResultsRaw = results.slice();
  globalState.searchResults = results; 

  const resultsCount = document.getElementById('resultsCount');
  const resultsSection = document.getElementById('resultsSection');
  const paginationControls = document.getElementById('paginationControls');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const pageInfo = document.getElementById('pageInfo');

  if (resultsCount) {
    resultsCount.textContent = `${globalState.totalHits} نتیجه یافت شد`;
  }

  if (resultsSection) {
    resultsSection.style.display = 'block';
    resultsSection.classList.add('show');
  }

  const totalPages = Math.max(1, Math.ceil(globalState.totalHits / SEARCH_CONFIG.PAGE_SIZE));
  if (paginationControls) {
    paginationControls.style.display = globalState.totalHits > SEARCH_CONFIG.PAGE_SIZE ? 'flex' : 'none';
    if (prevPageBtn) prevPageBtn.disabled = globalState.currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = globalState.currentPage >= totalPages;
    if (pageInfo) pageInfo.textContent = `صفحه ${globalState.currentPage} از ${totalPages}`;
  }

  attachHeaderSortHandlers();

  applySortAndRender();
}


export async function handlePreviousPage() {
    if (globalState.currentPage <= 1) return;
    globalState.currentPage -= 1;
    try {
        const results = await performElasticsearchSearch(globalState.currentSearchParams, globalState.currentPage);
        displaySearchResults(results);
    } catch (error) {
        showError('جستجو ناموفق بود: ' + error.message);
    }
}


export async function handleNextPage() {
    const totalPages = Math.max(1, Math.ceil(globalState.totalHits / SEARCH_CONFIG.PAGE_SIZE));
    if (globalState.currentPage >= totalPages) return;
    globalState.currentPage += 1;
    try {
        const results = await performElasticsearchSearch(globalState.currentSearchParams, globalState.currentPage);
        displaySearchResults(results);
    } catch (error) {
        showError('جستجو ناموفق بود: ' + error.message);
    }
}


function renderResultsTable(rows) {
  const tbody = document.getElementById('resultsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          <h3>هیچ نتیجه‌ای یافت نشد</h3>
        </td>
      </tr>`;
    return;
  }

  rows.forEach(result => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(result.subject)}</td>
      <td>${escapeHtml(result.body)}</td>
      <td>${escapeHtml(result.sender || '')}</td>
      <td>${formatDate(result.date)}</td>`;
    tbody.appendChild(tr);
  });
}

function updateHeaderSortIndicators() {
  const { sortKey, sortDir } = globalState.resultsView;
  document.querySelectorAll('#resultsTable thead th.sortable').forEach(th => {
    th.classList.remove('asc', 'desc');
    const key = th.getAttribute('data-sort-key');
    if (sortKey && key === sortKey) th.classList.add(sortDir);
  });
}

function applySortAndRender() {
  const { sortKey, sortDir } = globalState.resultsView;
  let rows = [...globalState.pageResultsRaw];

  if (sortKey) {
    rows.sort((a, b) => {
      if (sortKey === 'date') {
        const da = new Date(a.date || '').getTime() || 0;
        const db = new Date(b.date || '').getTime() || 0;
        return sortDir === 'asc' ? (da - db) : (db - da);
      }
      const va = (a[sortKey] ?? '').toString();
      const vb = (b[sortKey] ?? '').toString();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  globalState.searchResults = rows;

  renderResultsTable(rows);
  updateHeaderSortIndicators();
}

let sortHandlersAttached = false;
function attachHeaderSortHandlers() {
  if (sortHandlersAttached) return;
  sortHandlersAttached = true;

  document.querySelectorAll('#resultsTable thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort-key');
      const rv = globalState.resultsView;

      if (rv.sortKey === key) {
        rv.sortDir = rv.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        rv.sortKey = key;
        rv.sortDir = 'asc';
      }
      applySortAndRender();
    });
  });
}
