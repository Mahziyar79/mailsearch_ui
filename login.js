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
    const loginBtn = document.querySelector('.login-btn');
    console.log(email,password);
    
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
        // Simulate API call (replace with actual authentication endpoint)
        const response = await authenticateUser(email, password);
        
        if (response.success) {
            // Store authentication data
            const authData = {
                email: email,
                token: response.token || 'demo-token',
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
    // This is a demo implementation
    // Replace with actual API call to your authentication server
    

    
    // Demo credentials (replace with actual authentication logic)
    const validCredentials = [
        { email: 'admin@example.com', password: '1' },
    ];
    
    const isValid = validCredentials.some(cred => 
        cred.email === email && cred.password === password
    );
    
    if (isValid) {
        return {
            success: true,
            token: 'demo-token-' + Date.now(),
            user: { email: email }
        };
    } else {
        return {
            success: false,
            message: 'ایمیل یا رمز عبور اشتباه است'
        };
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

