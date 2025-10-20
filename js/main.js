
import { isLoggedIn,getAuthHeaders } from './auth.js';
import { showError } from './utils.js';
import { BACKEND_CONFIG, globalState } from './config.js';
import { handleSearch, handlePreviousPage, handleNextPage } from './search.js';
import { handleChat } from './chat.js';
import { 
    loadSessions, 
    showNewSessionForm, 
    hideNewSessionForm, 
    handleCreateSession,
    cleanupEmptySessions
} from './session.js';

function initializeEventListeners() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
        cleanupEmptySessions({ keepalive: true });
        }
    });
    window.addEventListener('beforeunload', () => {
        cleanupEmptySessions({ keepalive: true });
    });
    // Search form
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearch);
    }

    // Chat form
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChat);
    }

    // Session management
    const createSessionForm = document.getElementById('createSessionForm');
    if (createSessionForm) {
        createSessionForm.addEventListener('submit', handleCreateSession);
    }

    const newSessionBtn = document.getElementById('newSessionBtn');
    if (newSessionBtn) {
        newSessionBtn.addEventListener('click', showNewSessionForm);
    }

    const cancelSessionBtn = document.getElementById('cancelSessionBtn');
    if (cancelSessionBtn) {
        cancelSessionBtn.addEventListener('click', hideNewSessionForm);
    }

    // Pagination controls
    const prevPageBtn = document.getElementById('prevPage');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', handlePreviousPage);
    }

    const nextPageBtn = document.getElementById('nextPage');
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', handleNextPage);
    }
}

/**
 * Initialize the application
 */
async function initializeApp() {
    // Check authentication first
    if (!isLoggedIn()) {
        window.location.href = '/login';
        return;
    }

    try {
        const res = await fetch(`${BACKEND_CONFIG.URL}/auth/me`, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        
        if (res.ok) {
            const me = await res.json();
            const email = (me?.email || '').toLowerCase();
            globalState.currentUserEmail = email;
            globalState.isAdmin = email === 'admin@steelalborz.com';
        } else {
            globalState.currentUserEmail = null;
            globalState.isAdmin = false;
        }
    } catch {
        globalState.currentUserEmail = null;
        globalState.isAdmin = false;
    }
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Load sessions
    try {
        await loadSessions();
    } catch (err) {
        showError('خطا در دریافت جلسات: ' + (err?.message || err));
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
