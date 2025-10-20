import { ELASTICSEARCH_CONFIG, SEARCH_CONFIG, globalState } from './config.js';
import { escapeHtml, formatDate, showError } from './utils.js';
import { createAndSelectSession } from './session.js';


function buildElasticsearchQuery(params, page) {
    const query = {
        query: {
            bool: {
                must: []
            }
        },
        size: SEARCH_CONFIG.PAGE_SIZE,
        // Prefer score when text query exists; otherwise sort by date
        sort: [
            { _score: { order: 'desc' } },
            { date: { order: 'desc' } }
        ],
        from: (Math.max(1, page) - 1) * SEARCH_CONFIG.PAGE_SIZE
    };

    // Add text search if provided
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
    globalState.searchResults = results;
    const resultsCount = document.getElementById('resultsCount');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const resultsSection = document.getElementById('resultsSection');
    const paginationControls = document.getElementById('paginationControls');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (resultsCount) {
        resultsCount.textContent = `${globalState.totalHits} نتیجه یافت شد`;
    }
    
    // Clear previous results
    if (resultsTableBody) {
        resultsTableBody.innerHTML = '';
        
        if (results.length === 0) {
            resultsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <h3>هیچ نتیجه‌ای یافت نشد</h3>
                        <p>معیارهای جستجوی خود را تنظیم کنید</p>
                    </td>
                </tr>
            `;
        } else {
            results.forEach(result => {
                const row = document.createElement('tr');
                row.innerHTML = `
                <td>${escapeHtml(result.subject)}</td>
                <td>${escapeHtml(result.body)}</td>
                <td>${escapeHtml(result.sender || '')}</td>
                <td>${formatDate(result.date)}</td>
                `;
                resultsTableBody.appendChild(row);
            });
        }
    }
    
    if (resultsSection) {
        resultsSection.style.display = 'block';
        resultsSection.classList.add('show');
    }

    // Update pagination controls
    const totalPages = Math.max(1, Math.ceil(globalState.totalHits / SEARCH_CONFIG.PAGE_SIZE));
    if (paginationControls) {
        paginationControls.style.display = globalState.totalHits > SEARCH_CONFIG.PAGE_SIZE ? 'flex' : 'none';
        if (prevPageBtn) prevPageBtn.disabled = globalState.currentPage <= 1;
        if (nextPageBtn) nextPageBtn.disabled = globalState.currentPage >= totalPages;
        if (pageInfo) pageInfo.textContent = `صفحه ${globalState.currentPage} از ${totalPages}`;
    }
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
