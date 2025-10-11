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
const BACKEND_URL = window.CONFIG.BACKEND.URL;

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
// عناصر بخش جلسات
const createSessionForm = document.getElementById('createSessionForm');
const sessionTitleInput = document.getElementById('sessionTitle');
const sessionsList = document.getElementById('sessionsList');
const newSessionBtn = document.getElementById('newSessionBtn');
const cancelSessionBtn = document.getElementById('cancelSessionBtn');
const currentSessionTitle = document.getElementById('currentSessionTitle');

// Global variables for sessions
let currentSessionId = null;
let sessions = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!isLoggedIn()) {
        window.location.href = '/login';
        return;
    }
    
    initializeEventListeners();
    // بارگذاری اولیه لیست سشن‌ها
    loadSessions().catch(err => showError('خطا در دریافت جلسات: ' + (err?.message || err)));
});

function initializeEventListeners() {
    searchForm.addEventListener('submit', handleSearch);
    chatForm.addEventListener('submit', handleChat);
    if (createSessionForm) {
        createSessionForm.addEventListener('submit', handleCreateSession);
    }
    if (newSessionBtn) {
        newSessionBtn.addEventListener('click', showNewSessionForm);
    }
    if (cancelSessionBtn) {
        cancelSessionBtn.addEventListener('click', hideNewSessionForm);
    }
}

function getAuthHeaders() {
  // authData: { email, token, tokenType, timestamp }
  const raw = localStorage.getItem('authData');
  if (!raw) return {};
  try {
    const auth = JSON.parse(raw);
    const type = (auth.tokenType || 'bearer').trim();
    return { 'Authorization': `${type.charAt(0).toUpperCase() + type.slice(1)} ${auth.token}` };
  } catch {
    return {};
  }
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
    
    // Check if a session is selected
    if (!currentSessionId) {
        showError('لطفاً ابتدا یک جلسه انتخاب کنید');
        return;
    }
    
    // Add user message to UI
    addMessage('user', question);
    chatInput.value = '';
    
    // Save user message to backend
    try {
        await saveMessage(currentSessionId, question,'user');
    } catch (error) {
        console.error('Error saving user message:', error);
    }
    
    try {
        showLoading('در حال فکر کردن...');
        
        const response = await sendToLLM(question);

        const loadingDiv = document.querySelector('.loading-message');
        if (loadingDiv) loadingDiv.remove();

        // Add assistant message to UI
        addMessage('assistant', response);
        
        // Save assistant message to backend
        try {
            await saveMessage(currentSessionId, response, 'user');
        } catch (error) {
            console.error('Error saving assistant message:', error);
        }
    } catch (error) {
        const loadingDiv = document.querySelector('.loading-message');
        if (loadingDiv) loadingDiv.remove();

        const errorMessage = 'متاسفم، خطایی رخ داد: ' + error.message;
        addMessage('assistant', errorMessage);
        
        // Save error message to backend
        try {
            await saveMessage(currentSessionId, errorMessage,'assistant');
        } catch (saveError) {
            console.error('Error saving error message:', saveError);
        }
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

function addMessage(sender, content, scrollToBottom = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const time = new Date().toLocaleTimeString();
    messageDiv.innerHTML = `
        <div class="message-content">${escapeHtml(content)}</div>
        <div class="message-time">${time}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    if (scrollToBottom) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
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



// Session management functions
async function loadSessions() {
  const res = await fetch(`${BACKEND_URL}/sessions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  });
  if (!res.ok) {
    if (res.status === 401) {
      logout();
      return;
    }
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to load sessions: ${res.status} ${txt}`);
  }
  const data = await res.json();
  sessions = data;
  renderSessions(data);
  
  // Auto-select first session if none is selected
  if (data.length > 0 && !currentSessionId) {
    selectSession(data[0]);
  }
}

function renderSessions(items) {
  sessionsList.innerHTML = '';
  if (!items || items.length === 0) {
    sessionsList.innerHTML = `
      <div class="empty-state" style="padding: 20px; text-align: center; color: #666;">
        <p>هیچ جلسه‌ای یافت نشد</p>
      </div>`;
    return;
  }
  
  items.forEach(session => {
    const sessionItem = document.createElement('div');
    sessionItem.className = 'session-item';
    sessionItem.dataset.sessionId = session.id;
    sessionItem.innerHTML = `
      <div class="session-title">${escapeHtml(session.title || 'جلسه بدون عنوان')}</div>
      <div class="session-date">${formatDate(session.created_at)}</div>
    `;
    
    sessionItem.addEventListener('click', () => selectSession(session));
    sessionsList.appendChild(sessionItem);
  });
}

async function selectSession(session) {
  // Update current session
  currentSessionId = session.id;
  currentSessionTitle.textContent = session.title || 'جلسه بدون عنوان';
  
  // Update UI - remove active class from all items
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Add active class to selected item
  const selectedItem = document.querySelector(`[data-session-id="${session.id}"]`);
  if (selectedItem) {
    selectedItem.classList.add('active');
  }
  
  // Load messages for this session
  await loadSessionMessages(session.id);
}

async function loadSessionMessages(sessionId) {
  try {
    const res = await fetch(`${BACKEND_URL}/sessions/${sessionId}/messages`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.status === 404) {
        // Messages endpoint not implemented yet, show empty state
        displayMessages([]);
        return;
      }
      throw new Error(`Failed to load messages: ${res.status}`);
    }
    
    const messages = await res.json();
    displayMessages(messages);
  } catch (error) {
    console.error('Error loading messages:', error);
    // If it's a network error or endpoint doesn't exist, show empty state
    if (error.message.includes('Failed to fetch') || error.message.includes('404')) {
      displayMessages([]);
    } else {
      showError('خطا در بارگذاری پیام‌ها: ' + error.message);
    }
  }
}

function displayMessages(messages) {
  chatMessages.innerHTML = '';
  
  if (!messages || messages.length === 0) {
    chatMessages.innerHTML = `
      <div class="empty-state" style="text-align: center; color: #666; padding: 40px;">
        <p>هیچ پیامی در این جلسه وجود ندارد</p>
        <p>سوالی بپرسید تا گفتگو شروع شود</p>
      </div>`;
    return;
  }
  
  messages.forEach(message => {
    const sender = message.role === 'assistant' ? 'assistant' : 'user';
    addMessage(sender, message.content, false);
  });
}

async function saveMessage(sessionId, content,role = 'user') {
  try {
    const res = await fetch(`${BACKEND_URL}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ content, role })
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.status === 404) {
        console.warn('Messages endpoint not implemented yet');
        return null;
      }
      throw new Error(`Failed to save message: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.warn('Error saving message:', error);
    return null;
  }
}

// New session form management
function showNewSessionForm() {
  createSessionForm.style.display = 'block';
  newSessionBtn.style.display = 'none';
  sessionTitleInput.focus();
}

function hideNewSessionForm() {
  createSessionForm.style.display = 'none';
  newSessionBtn.style.display = 'block';
  sessionTitleInput.value = '';
}

async function handleCreateSession(e) {
  e.preventDefault();
  const title = (sessionTitleInput.value || '').trim();
  
  if (!title) {
    showError('لطفاً عنوان جلسه را وارد کنید');
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ title })
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        logout();
        return;
      }
      const txt = await res.text().catch(() => '');
      showError('ساخت جلسه ناموفق بود: ' + txt);
      return;
    }
    
    const newSession = await res.json();
    hideNewSessionForm();
    await loadSessions();
    
    // Auto-select the newly created session
    selectSession(newSession);
  } catch (error) {
    showError('خطا در ایجاد جلسه: ' + error.message);
  }
}
