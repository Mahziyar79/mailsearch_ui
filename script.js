const ELASTICSEARCH_URL = window.CONFIG.ELASTICSEARCH.URL;
const INDEX_NAME = window.CONFIG.ELASTICSEARCH.INDEX_NAME;
const ELASTIC_USERNAME = window.CONFIG.ELASTICSEARCH.USERNAME;
const ELASTIC_PASSWORD = window.CONFIG.ELASTICSEARCH.PASSWORD;

const LLM_API_URL = window.CONFIG.LLM_API.URL;
// Global variables
let searchResults = [];
let currentSearchParams = {};
let totalHits = 0;
let pageSize = 50;
let currentPage = 1;

// DOM elements
const searchForm = document.getElementById('searchForm');
const resultsSection = document.getElementById('resultsSection');
const resultsTableBody = document.getElementById('resultsTableBody');
const resultsCount = document.getElementById('resultsCount');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const paginationControls = document.getElementById('paginationControls');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!isLoggedIn()) {
        window.location.href = '/login';
        return;
    }
    
    initializeEventListeners();
});

function initializeEventListeners() {
    searchForm.addEventListener('submit', handleSearch);
    chatForm.addEventListener('submit', handleChat);
}

// Search functionality
async function handleSearch(e) {
    e.preventDefault();
    
    const formData = new FormData(searchForm);
    const searchParams = {
        searchText: formData.get('searchText') || '',
        searchFields: Array.from(document.querySelectorAll('input[name="searchFields"]:checked')).map(cb => cb.value),
        operator: formData.get('operator') || 'or',
        dateFrom: formData.get('dateFrom') || '',
        dateTo: formData.get('dateTo') || ''
    };

    currentSearchParams = searchParams;
    currentPage = 1;
    try {
        const results = await performElasticsearchSearch(searchParams, currentPage);
        displaySearchResults(results);
    } catch (error) {
        showError('جستجو ناموفق بود: ' + error.message);
    }
}

async function performElasticsearchSearch(params, page) {
    const query = buildElasticsearchQuery(params, page);
    
    const headers = {
        'Content-Type': 'application/json',
    };

    // Add Basic Auth header if credentials are provided in config
    if (ELASTIC_USERNAME && ELASTIC_PASSWORD) {
        headers['Authorization'] = 'Basic ' + btoa(`${ELASTIC_USERNAME}:${ELASTIC_PASSWORD}`);
    }

    const response = await fetch(`${ELASTICSEARCH_URL}/${INDEX_NAME}/_search?size=${pageSize}&from=${(page - 1) * pageSize}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(query)
    });

    if (!response.ok) {
        throw new Error(`Elasticsearch request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    totalHits = (typeof data.hits.total === 'object') ? data.hits.total.value : (data.hits.total || 0);
    return data.hits.hits.map(hit => ({
        id: hit._id,
        subject: hit._source.subject || '',
        body: hit._source.body || '',
        sender: hit._source.sender || hit._source.from || '',
        date: hit._source.date || hit._source.timestamp || '',
    }));
}

function buildElasticsearchQuery(params, page) {
    const query = {
        query: {
            bool: {
                must: []
            }
        },
        size: pageSize,
        // Prefer score when text query exists; otherwise sort by date
        sort: [
            { _score: { order: 'desc' } },
            { date: { order: 'desc' } }
        ],
        from: (Math.max(1, page) - 1) * pageSize
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

function displaySearchResults(results) {
    searchResults = results;
    resultsCount.textContent = `${totalHits} نتیجه یافت شد`;
    
    // Clear previous results
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
    
    resultsSection.style.display = 'block';
    resultsSection.classList.add('show');

    // Update pagination controls
    const totalPages = Math.max(1, Math.ceil(totalHits / pageSize));
    if (paginationControls) {
        paginationControls.style.display = totalHits > pageSize ? 'flex' : 'none';
        if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
        if (pageInfo) pageInfo.textContent = `صفحه ${currentPage} از ${totalPages}`;
    }
}

// Pagination handlers
if (prevPageBtn) {
    prevPageBtn.addEventListener('click', async function() {
        if (currentPage <= 1) return;
        currentPage -= 1;
        try {
            const results = await performElasticsearchSearch(currentSearchParams, currentPage);
            displaySearchResults(results);
        } catch (error) {
            showError('جستجو ناموفق بود: ' + error.message);
        }
    });
}

if (nextPageBtn) {
    nextPageBtn.addEventListener('click', async function() {
        const totalPages = Math.max(1, Math.ceil(totalHits / pageSize));
        if (currentPage >= totalPages) return;
        currentPage += 1;
        try {
            const results = await performElasticsearchSearch(currentSearchParams, currentPage);
            displaySearchResults(results);
        } catch (error) {
            showError('جستجو ناموفق بود: ' + error.message);
        }
    });
}

// Chat functionality
async function handleChat(e) {
    e.preventDefault();
    
    const question = chatInput.value.trim();
    if (!question) return;
    
    addMessage('user', question);
    chatInput.value = '';
    
    try {
        showLoading('در حال فکر کردن...');
        
        const response = await sendToLLM(question);

        const loadingDiv = document.querySelector('.loading-message');
        if (loadingDiv) loadingDiv.remove();

        addMessage('assistant', response);
    } catch (error) {
        const loadingDiv = document.querySelector('.loading-message');
        if (loadingDiv) loadingDiv.remove();

        addMessage('assistant', 'متاسفم، خطایی رخ داد: ' + error.message);
    }
}

async function sendToLLM(question) {
    const requestBody = {
        question: question,
        context: searchResults.length > 0 ? {
            searchResults: searchResults,
            searchParams: currentSearchParams
        } : null
    };

    const response = await fetch(LLM_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`LLM API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || data.answer || data.message || 'پاسخی دریافت نشد';
}

function addMessage(sender, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const time = new Date().toLocaleTimeString();
    messageDiv.innerHTML = `
        <div class="message-content">${escapeHtml(content)}</div>
        <div class="message-time">${time}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    } catch (error) {
        return dateString;
    }
}

function showLoading(message) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-message';
    loadingDiv.innerHTML = `
        <div class="loading"></div>
        <span>${message}</span>
    `;
    
    const existingLoading = document.querySelector('.loading-message');
    if (existingLoading) {
        existingLoading.remove();
    }
    
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    
    const existingError = document.querySelector('.error');
    if (existingError) {
        existingError.remove();
    }
    
    const container = document.querySelector('.container');
    container.insertBefore(errorDiv, container.firstChild);
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Authentication functions
function isLoggedIn() {
    const authData = localStorage.getItem('authData');
    if (!authData) return false;
    
    try {
        const parsed = JSON.parse(authData);
        // Check if token is not expired (24 hours)
        const isExpired = Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000;
        return !isExpired;
    } catch (error) {
        return false;
    }
}

function logout() {
    localStorage.removeItem('authData');
    window.location.href = '/login';
}



