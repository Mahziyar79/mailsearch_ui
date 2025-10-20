// Elasticsearch configuration
export const ELASTICSEARCH_CONFIG = {
    URL: window.CONFIG.ELASTICSEARCH.URL,
    INDEX_NAME: window.CONFIG.ELASTICSEARCH.INDEX_NAME,
    USERNAME: window.CONFIG.ELASTICSEARCH.USERNAME,
    PASSWORD: window.CONFIG.ELASTICSEARCH.PASSWORD
};

// LLM API configuration
export const LLM_CONFIG = {
    URL: window.CONFIG.LLM_API.URL
};

// Backend configuration
export const BACKEND_CONFIG = {
    URL: window.CONFIG.BACKEND.URL
};

// Search configuration
export const SEARCH_CONFIG = {
    PAGE_SIZE: 50,
    DEFAULT_OPERATOR: 'or'
};

// Global state variables
export const globalState = {
    searchResults: [],
    currentSearchParams: {},
    totalHits: 0,
    currentPage: 1,
    currentSessionId: null,
    sessions: [],
    hasElasticRequest: false,
    currentUserEmail: null,
    isAdmin: false,
};
