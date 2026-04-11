// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker failure:', err));
    });
}

// --- DOM Elements ---
const chatArea = document.getElementById('chatArea');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const cryptoKey = document.getElementById('cryptoKey');
const cryptoMode = document.getElementById('cryptoMode');
const toast = document.getElementById('toast');

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight < 100 ? this.scrollHeight : 100) + 'px';
});

// --- Chat UI Functions ---
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'msg-text';
    textDiv.textContent = text;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'msg-time';
    timeDiv.textContent = getCurrentTime();

    msgDiv.appendChild(textDiv);
    msgDiv.appendChild(timeDiv);

    // Click to copy
    msgDiv.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(text);
            showToast();
        } catch (err) {
            console.error('Failed to copy text', err);
        }
    });

    chatArea.appendChild(msgDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function showToast() {
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

// --- Cryptography Functions (Web Crypto API) ---
const enc = new TextEncoder();
const dec = new TextDecoder();

// Helper: Convert ArrayBuffer to Base64
function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
function base64ToBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

// Derive AES-GCM key using PBKDF2
async function getDerivedKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

async function encryptMessage(text, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getDerivedKey(password, salt);
    
    const cipherText = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(text)
    );

    // Concat: salt (16) + iv (12) + ciphertext
    const payload = new Uint8Array(salt.byteLength + iv.byteLength + cipherText.byteLength);
    payload.set(salt, 0);
    payload.set(iv, salt.byteLength);
    payload.set(new Uint8Array(cipherText), salt.byteLength + iv.byteLength);

    return bufferToBase64(payload.buffer);
}

async function decryptMessage(base64Payload, password) {
    try {
        const payload = new Uint8Array(base64ToBuffer(base64Payload));
        
        // Extract parts
        const salt = payload.slice(0, 16);
        const iv = payload.slice(16, 28);
        const cipherText = payload.slice(28);

        const key = await getDerivedKey(password, salt);
        
        const decryptedContent = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            cipherText
        );

        return dec.decode(decryptedContent);
    } catch (e) {
        throw new Error("Decryption failed. Invalid text or wrong key.");
    }
}

// --- Main Event Listener ---
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const text = messageInput.value.trim();
    const key = cryptoKey.value.trim();
    const mode = cryptoMode.value;

    if (!text || !key) return;

    // 1. Show user input as a "Received" message
    addMessage(text, 'msg-received');

    // 2. Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // 3. Process and output as "Sent" message
    try {
        let resultText = '';
        if (mode === 'encrypt') {
            resultText = await encryptMessage(text, key);
            addMessage(resultText, 'msg-sent');
        } else {
            resultText = await decryptMessage(text, key);
            addMessage(resultText, 'msg-sent');
        }
    } catch (err) {
        addMessage(`⚠️ Error: ${err.message}`, 'msg-sent msg-error');
    }
});
  
