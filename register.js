// Register functionality
document.addEventListener('DOMContentLoaded', function () {
  const registerForm = document.getElementById('registerForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  if (isLoggedIn()) {
    redirectToMain();
    return;
  }

  registerForm.addEventListener('submit', handleRegister);

  passwordInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      handleRegister(e);
    }
  });
});

async function handleRegister(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showError('لطفاً تمام فیلدها را پر کنید');
    return;
  }
  if (!isValidEmail(email)) {
    showError('لطفاً یک ایمیل معتبر وارد کنید');
    return;
  }

  setLoadingState(true);
  clearError();

  try {
    const res = await fetch(`${CONFIG.BACKEND.URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        (data && (data.detail || data.message)) ||
        (res.status === 409 ? 'این ایمیل قبلاً ثبت شده است' : 'ثبت‌نام ناموفق بود');
      showError(msg);
      return;
    }

    persistAuth(email, data.access_token, data.token_type || 'bearer');
    redirectToMain();
  } catch (err) {
    console.error('Register error:', err);
    showError('عدم دسترسی به سرور');
  } finally {
    setLoadingState(false);
  }
}


async function authenticateUser(email, password) {
  try {
    const res = await fetch(`${CONFIG.BACKEND.URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data && (data.detail || data.message);
      return { success: false, message: message || 'ایمیل یا رمز عبور اشتباه است' };
    }

    return {
      success: true,
      token: data.access_token,
      tokenType: data.token_type || 'bearer'
    };
  } catch {
    return { success: false, message: 'عدم دسترسی به سرور' };
  }
}

function persistAuth(email, token, tokenType) {
  const authData = {
    email,
    token,
    tokenType: tokenType || 'bearer',
    timestamp: Date.now()
  };
  localStorage.setItem('authData', JSON.stringify(authData));
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function showError(message) {
  clearError();
  const errorDiv = document.createElement('div');
  errorDiv.className = 'login-error';
  errorDiv.textContent = message;
  const form = document.getElementById('registerForm');
  form.insertBefore(errorDiv, form.firstChild);
}

function clearError() {
  const existing = document.querySelector('.login-error');
  if (existing) existing.remove();
}

function setLoadingState(isLoading) {
  const btn = document.querySelector('.register-btn');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  if (isLoading) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = 'در حال ثبت‌نام...';
    emailInput.disabled = true;
    passwordInput.disabled = true;
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.textContent = 'ثبت‌نام';
    emailInput.disabled = false;
    passwordInput.disabled = false;
  }
}

function isLoggedIn() {
  const authData = localStorage.getItem('authData');
  if (!authData) return false;
  try {
    const parsed = JSON.parse(authData);
    const isExpired = Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000;
    return !isExpired;
  } catch {
    return false;
  }
}

function redirectToMain() {
  window.location.href = '/';
}
