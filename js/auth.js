import { cleanupEmptySessions } from './session.js';

export function getAuthHeaders() {
    const raw = localStorage.getItem('authData');
    if (!raw) return {};
    
    try {
        const auth = JSON.parse(raw);
        const type = (auth.tokenType || 'bearer').trim();
        return { 
            'Authorization': `${type.charAt(0).toUpperCase() + type.slice(1)} ${auth.token}` 
        };
    } catch {
        return {};
    }
}

export function isLoggedIn() {
    const authData = localStorage.getItem('authData');
    if (!authData) return false;
    
    try {
        const parsed = JSON.parse(authData);
        const isExpired = Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000;
        return !isExpired;
    } catch (error) {
        return false;
    }
}

export async function logout() {
    try {
        await cleanupEmptySessions();
    } catch (e) {
        console.warn("Cleanup before logout failed", e);
    }
    localStorage.removeItem('authData');
    window.location.href = '/login';
}

export function handleAuthError(response) {
    if (response.status === 401) {
        logout();
        return true;
    }
    return false;
}
