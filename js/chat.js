/**
 * Chat module
 * Handles LLM communication and chat functionality
 */

import { LLM_CONFIG, globalState } from './config.js';
import { escapeHtml, showLoading, removeLoading, showError } from './utils.js';
import { saveMessage } from './session.js';


function buildContextTextFromResults(results, maxItems = 5, maxChars = 8000) {
  if (!results || results.length === 0) return '';

  let combined = results
    .slice(0, maxItems)
    .map(r => {
      const subject = (r.subject || '').toString();
      const body = (r.body || '').toString();
      const sender = (r.sender || '').toString();
      const date = (r.date || '').toString();
      return `${subject} ${body} ${sender} ${date}`.trim();
    })
    .join(' ');

  return combined;
}

async function sendToLLM(question) {
  const string1 = buildContextTextFromResults(globalState.searchResults, 5, 6000);
  const string2 = question;

  const payload = { string1, string2 };

  const response = await fetch(LLM_CONFIG.URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`LLM API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || 'پاسخی دریافت نشد';
}


export function addMessage(sender, content, scrollToBottom = true) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const empty = chatMessages.querySelector('.empty-state');
    if (empty) {
        chatMessages.innerHTML = '';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    messageDiv.innerHTML = `
        <div class="message-content">${escapeHtml(content)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    if (scrollToBottom) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}


export async function handleChat(e){
    e.preventDefault();
    
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;
    
    const question = chatInput.value.trim();
    if (!question) return;

    if (!globalState.hasElasticRequest) {
        showError('ابتدا یک جستجو انجام دهید تا زمینهٔ لازم فراهم شود.');
        return;
    }
    
    // Check if a session is selected
    if (!globalState.currentSessionId) {
        showError('لطفاً ابتدا یک جلسه انتخاب کنید');
        return;
    }
    
    // Add user message to UI
    addMessage('user', question);
    chatInput.value = '';
    
    // Save user message to backend
    try {
        await saveMessage(globalState.currentSessionId, question, 'user');
    } catch (error) {
        console.error('Error saving user message:', error);
    }
    
    try {
        showLoading('در حال فکر کردن...');
        
        const response = await sendToLLM(question);
        removeLoading();

        // Add assistant message to UI
        addMessage('assistant', response);
        
        // Save assistant message to backend
        try {
            await saveMessage(globalState.currentSessionId, response, 'assistant');
        } catch (error) {
            console.error('Error saving assistant message:', error);
        }
    } catch (error) {
        removeLoading();

        const errorMessage = 'متاسفم، خطایی رخ داد: ' + error.message;
        addMessage('assistant', errorMessage);
        
        // Save error message to backend
        try {
            await saveMessage(globalState.currentSessionId, errorMessage, 'assistant');
        } catch (saveError) {
            console.error('Error saving error message:', saveError);
        }
    }
}
