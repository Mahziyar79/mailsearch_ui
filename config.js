const CONFIG = {
    // Backend API
    BACKEND: {
        URL: 'http://172.16.55.24:9000'
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
        URL: 'http://localhost:5000/api/chat',
        // Add authentication headers if needed
        HEADERS: {
            'Content-Type': 'application/json',
            // 'Authorization': 'Bearer your-token',
            // 'X-API-Key': 'your-api-key'
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
