const CONFIG = {
    // Backend API
    BACKEND: {
        URL: 'http://localhost:9000'
    },
    // Elasticsearch Configuration
    ELASTICSEARCH: {
        URL: 'http://172.16.55.24:9200',
        INDEX_NAME: 'email_exchange',
        USERNAME: 'elastic',
        PASSWORD: 'fIZagtfzx1q6hGp9jQZm',
    },
    
    // LLM API Configuration
    LLM_API: {
        URL: 'http://172.16.55.28:5000/combine',
        HEADERS: {
            'Content-Type': 'application/json',
        }
    },
    
    // Application Settings
    APP: {
        MAX_RESULTS: 100,
        DEFAULT_SEARCH_FIELDS: ['subject', 'body'],
        DEFAULT_OPERATOR: 'or',
        CHAT_HISTORY_LIMIT: 50
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
