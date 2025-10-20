import { BACKEND_CONFIG, globalState } from './config.js';
import { getAuthHeaders, handleAuthError, logout } from './auth.js';
import { escapeHtml, formatDate, showError } from './utils.js';
import { addMessage } from './chat.js';

globalState.sessionMessages = globalState.sessionMessages || {};

export async function loadSessions() {
    const res = await fetch(`${BACKEND_CONFIG.URL}/sessions`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        }
    });
    
    if (!res.ok) {
        if (handleAuthError(res)) return;
        const txt = await res.text().catch(() => '');
        throw new Error(`Failed to load sessions: ${res.status} ${txt}`);
    }
    
    const data = await res.json();
    globalState.sessions = data;
    renderSessions(data);
    
    if (data.length > 0 && !globalState.currentSessionId) {
        selectSession(data[0]);
    }
}

export function renderSessions(items) {
    const sessionsList = document.getElementById('sessionsList');
    if (!sessionsList) return;
    
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
            <div class="session-header">
                <div class="session-info">
                    <div class="session-title">${escapeHtml(session.title || 'جلسه بدون عنوان')}</div>
                    <div class="session-date">${formatDate(session.created_at)}</div>
                </div>
                <div class="session-btns"> 
                    <button class="edit-session-btn" title="ویرایش عنوان" data-id="${session.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18">
                        <path d="M403.4 83.6c12.5-12.5 32.8-12.5 45.3 0l107.7 107.7c12.5 12.5 12.5 32.8 0 45.3L267.2 625.8c-6 6-13.6 10.1-22 11.8L96 664c-17.7 3.5-33.9-12.7-30.4-30.4l26.3-149.2c1.7-8.4 5.8-16 11.8-22L403.4 83.6zM574.6 169.9L466.9 62.2l28.3-28.3c12.5-12.5 32.8-12.5 45.3 0l57.4 57.4c12.5 12.5 12.5 32.8 0 45.3l-23.3 33.3zM240 520l-80 16 16-80 64 64z"/>
                        </svg>
                    </button>
                    <button class="delete-session-btn" title="حذف جلسه" data-id="${session.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z"/></svg>
                    </button>
                </div>
            </div>
        `;
        
        sessionItem.addEventListener('click', () => selectSession(session));

        const editBtn = sessionItem.querySelector('.edit-session-btn');
        editBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await promptAndUpdateSessionTitle(session);
        });

        const deleteBtn = sessionItem.querySelector('.delete-session-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deleteSession(session.id);
        });

        sessionsList.appendChild(sessionItem);
    });
}


export async function selectSession(session) {
    // Update current session
    globalState.currentSessionId = session.id;
    const currentSessionTitle = document.getElementById('currentSessionTitle');
    if (currentSessionTitle) {
        currentSessionTitle.textContent = session.title || 'جلسه بدون عنوان';
    }
    
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

export async function loadSessionMessages(sessionId) {
    try {
        const res = await fetch(`${BACKEND_CONFIG.URL}/sessions/${sessionId}/messages`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            }
        });
        
        if (!res.ok) {
            if (handleAuthError(res)) return;
            if (res.status === 404) {
                // Messages endpoint not implemented yet, show empty state
                displayMessages([]);
                return;
            }
            throw new Error(`Failed to load messages: ${res.status}`);
        }
        
        const messages = await res.json();
        globalState.sessionMessages = globalState.sessionMessages || {};
        globalState.sessionMessages[sessionId] = messages;
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


export function displayMessages(messages) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
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


export async function saveMessage(sessionId, content, role = 'user') {
    try {
        const res = await fetch(`${BACKEND_CONFIG.URL}/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ content, role })
        });
        
        if (!res.ok) {
            if (handleAuthError(res)) return null;
            if (res.status === 404) {
                console.warn('Messages endpoint not implemented yet');
                return null;
            }
            throw new Error(`Failed to save message: ${res.status}`);
        }
        
        const saved = await res.json();

        globalState.sessionMessages = globalState.sessionMessages || {};
        if (!globalState.sessionMessages[sessionId]) {
            globalState.sessionMessages[sessionId] = [];
        }
        globalState.sessionMessages[sessionId].push(saved);

        return saved;
    } catch (error) {
        console.warn('Error saving message:', error);
        return null;
    }
}

/**
 * Show new session form
 */
export function showNewSessionForm() {
    const createSessionForm = document.getElementById('createSessionForm');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const sessionTitleInput = document.getElementById('sessionTitle');
    
    if (createSessionForm) createSessionForm.style.display = 'block';
    if (newSessionBtn) newSessionBtn.style.display = 'none';
    if (sessionTitleInput) sessionTitleInput.focus();
}

/**
 * Hide new session form
 */
export function hideNewSessionForm() {
    const createSessionForm = document.getElementById('createSessionForm');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const sessionTitleInput = document.getElementById('sessionTitle');
    
    if (createSessionForm) createSessionForm.style.display = 'none';
    if (newSessionBtn) newSessionBtn.style.display = 'block';
    if (sessionTitleInput) sessionTitleInput.value = '';
}

/**
 * Handle create session form submission
 * @param {Event} e - Form submit event
 */
export async function handleCreateSession(e) {
    e.preventDefault();
    const sessionTitleInput = document.getElementById('sessionTitle');
    if (!sessionTitleInput) return;
    
    const title = (sessionTitleInput.value || '').trim();
    
    if (!title) {
        showError('لطفاً عنوان جلسه را وارد کنید');
        return;
    }

    try {
        const res = await fetch(`${BACKEND_CONFIG.URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ title })
        });
        
        if (!res.ok) {
            if (handleAuthError(res)) return;
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


export async function deleteSession(id) {
    const confirmDelete = confirm('آیا از حذف این جلسه اطمینان دارید؟');
    if (!confirmDelete) return;

    try {
        const res = await fetch(`${BACKEND_CONFIG.URL}/sessions/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            }
        });

        if (res.status === 204) {
            if (globalState.currentSessionId === id) {
                globalState.currentSessionId = null;
                const chatMessages = document.getElementById('chatMessages');
                const currentSessionTitle = document.getElementById('currentSessionTitle');
                
                if (chatMessages) chatMessages.innerHTML = '';
                if (currentSessionTitle) currentSessionTitle.textContent = 'انتخاب جلسه';
            }
            if (globalState.sessionMessages) {
            delete globalState.sessionMessages[id];
            }
            await loadSessions();
        } else if (res.status === 404) {
            showError('جلسه پیدا نشد یا قبلاً حذف شده است');
        } else if (res.status === 401) {
            logout();
        } else {
            const text = await res.text().catch(() => '');
            showError('خطا در حذف جلسه: ' + text);
        }
    } catch (error) {
        console.error('Error deleting session:', error);
        showError('خطا در ارتباط با سرور هنگام حذف جلسه');
    }
}

export async function updateSessionTitle(sessionId, newTitle) {
  const res = await fetch(`${BACKEND_CONFIG.URL}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ title: newTitle })
  });

  if (!res.ok) {
    if (handleAuthError(res)) return null;
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to update title: ${res.status} ${txt}`);
  }
  return await res.json();
}

export async function promptAndUpdateSessionTitle(session) {
  const current = session.title || '';
  const newTitle = prompt('عنوان جدید سشن را وارد کنید:', current);
  if (newTitle === null) return;
  const trimmed = newTitle.trim();
  if (!trimmed) {
    showError('عنوان نمی‌تواند خالی باشد');
    return;
  }

  try {
    const updated = await updateSessionTitle(session.id, trimmed);

    const idx = globalState.sessions.findIndex(s => s.id === session.id);
    if (idx !== -1) {
      globalState.sessions[idx] = updated;
    }

    renderSessions(globalState.sessions);

    if (globalState.currentSessionId === session.id) {
      const currentSessionTitle = document.getElementById('currentSessionTitle');
      if (currentSessionTitle) currentSessionTitle.textContent = updated.title || 'جلسه بدون عنوان';
    }

  } catch (err) {
    showError('به‌روزرسانی عنوان ناموفق بود: ' + err.message);
  }
}

export async function createAndSelectSession(title) {
  try {
    const res = await fetch(`${BACKEND_CONFIG.URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ title })
    });

    if (!res.ok) {
      if (handleAuthError(res)) return null;
      const txt = await res.text().catch(() => '');
      throw new Error(`Failed to create session: ${res.status} ${txt}`);
    }

    const newSession = await res.json();

    globalState.sessions = [newSession, ...(globalState.sessions || [])];
    renderSessions(globalState.sessions);

    await selectSession(newSession);
    return newSession;
  } catch (err) {
    showError('ساخت سشن جدید ناموفق بود: ' + err.message);
    return null;
  }
}

export async function cleanupEmptySessions(options = {}) {
  const { keepalive = false } = options;
  const sessions = globalState.sessions || [];

  if (!sessions.length) return;

  for (const session of sessions) {
    const sessionId = session.id;
    if (!sessionId) continue;

    const messages = globalState.sessionMessages?.[sessionId] || [];
    let hasMessages = messages.length > 0;

    if (!hasMessages) {
      try {
        const res = await fetch(
          `${BACKEND_CONFIG.URL}/sessions/${sessionId}/messages?limit=1`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
            keepalive
          }
        );

        if (res.ok) {
          const arr = await res.json();
          hasMessages = Array.isArray(arr) && arr.length > 0;
        } else {
          console.warn(`Couldn't check messages for session ${sessionId}`);
          continue;
        }
      } catch (err) {
        console.warn(`Could not verify messages from server for session ${sessionId}:`, err);
        continue;
      }
    }
    if (!hasMessages) {
      try {
        const delRes = await fetch(`${BACKEND_CONFIG.URL}/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          keepalive
        });

        if (delRes.status === 204) {
          console.log(`Deleted empty session ${sessionId}`);
        }
      } catch (err) {
        console.warn(`Error deleting empty session ${sessionId}:`, err);
      }
    }
  }
}

