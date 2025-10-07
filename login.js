// Login functionality
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.querySelector('.login-btn');

    // Check if user is already logged in
    if (isLoggedIn()) {
        redirectToMain();
        return;
    }

    // Add event listener for form submission
    loginForm.addEventListener('submit', handleLogin);

    // Add enter key support
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin(e);
        }
    });
});

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    // Validate inputs
    if (!email || !password) {
        showLoginError('لطفاً تمام فیلدها را پر کنید');
        return;
    }

    if (!isValidEmail(email)) {
        showLoginError('لطفاً یک ایمیل معتبر وارد کنید');
        return;
    }

    // Show loading state
    setLoadingState(true);
    clearLoginError();

    try {
        // Call real backend API for authentication
        const response = await authenticateUser(email, password);
        
        if (response.success) {
            // Store authentication data
            const authData = {
                email: email,
                token: response.token,
                tokenType: response.tokenType || 'bearer',
                timestamp: Date.now()
            };
            
            localStorage.setItem('authData', JSON.stringify(authData));
            
            // Redirect to main page
            redirectToMain();
        } else {
            showLoginError(response.message || 'ایمیل یا رمز عبور اشتباه است');
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('خطا در ورود. لطفاً دوباره تلاش کنید');
    } finally {
        setLoadingState(false);
    }
}

async function authenticateUser(email, password) {
    try {
        const res = await fetch(`${CONFIG.BACKEND.URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json().catch(() => ({}));
        
        if (!res.ok) {
            const message = data && (data.detail || data.message);
            return { success: false, message: message || 'ایمیل یا رمز عبور اشتباه است' };
        }
        
        // Expected shape from backend: { access_token: string, token_type: 'bearer' }
        return {
            success: true,
            token: data.access_token,
            tokenType: data.token_type || 'bearer'
        };
    } catch (err) {
        return { success: false, message: 'عدم دسترسی به سرور' };
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showLoginError(message) {
    clearLoginError();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'login-error';
    errorDiv.textContent = message;
    
    const form = document.getElementById('loginForm');
    form.insertBefore(errorDiv, form.firstChild);
}

function clearLoginError() {
    const existingError = document.querySelector('.login-error');
    if (existingError) {
        existingError.remove();
    }
}

function setLoadingState(isLoading) {
    const loginBtn = document.querySelector('.login-btn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (isLoading) {
        loginBtn.disabled = true;
        loginBtn.classList.add('loading');
        loginBtn.textContent = 'در حال ورود...';
        emailInput.disabled = true;
        passwordInput.disabled = true;
    } else {
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
        loginBtn.textContent = 'ورود';
        emailInput.disabled = false;
        passwordInput.disabled = false;
    }
}

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

function redirectToMain() {
    window.location.href = '/';
}

function logout() {
    localStorage.removeItem('authData');
    window.location.href = '/login';
}

// Make logout function globally available
window.logout = logout;

