/**
 * Main application script
 * Initializes the application and sets up event listeners
 */

import { isLoggedIn } from './auth.js';
import { showError } from './utils.js';
import { handleSearch, handlePreviousPage, handleNextPage } from './search.js';
import { handleChat } from './chat.js';
import { 
    loadSessions, 
    showNewSessionForm, 
    hideNewSessionForm, 
    handleCreateSession 
} from './session.js';

/**
 * Initialize event listeners for all interactive elements
 */
function initializeEventListeners() {
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
