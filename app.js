import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDM_7EwJccpcw-rfR3zdJpkMgGpv31l2J8",
    authDomain: "brocode-02.firebaseapp.com",
    databaseURL: "https://brocode-02-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "brocode-02",
    storageBucket: "brocode-02.firebasestorage.app",
    messagingSenderId: "926371747881",
    appId: "1:926371747881:web:ba8949370dc1da77b9a438",
    measurementId: "G-Q3ZX80FBFN"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const chatArea = document.getElementById('chatArea');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const cryptoKey = document.getElementById('cryptoKey');
const cryptoMode = document.getElementById('cryptoMode');
const toast = document.getElementById('toast');

const btnDarkMode = document.getElementById('btnDarkMode');
const btnClearAll = document.getElementById('btnClearAll');
const btnAbout = document.getElementById('btnAbout');
const aboutModal = document.getElementById('aboutModal');
const closeModal = document.getElementById('closeModal');
const imageInput = document.getElementById('imageInput');
const btnAttach = document.getElementById('btnAttach');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreviewName = document.getElementById('imagePreviewName');
const btnRemoveImage = document.getElementById('btnRemoveImage');

let selectedImageDataUrl = null;

window.onload = () => {
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
    }
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js').catch(err => console.log(err));
    }
};

btnDarkMode.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem("theme", isDark ? "dark" : "light");
});

btnClearAll.addEventListener('click', () => {
    chatArea.innerHTML = '';
    messageInput.value = '';
    cryptoKey.value = '';
    clearImageSelection();
});

btnAbout.addEventListener('click', () => aboutModal.classList.remove('hidden'));
closeModal.addEventListener('click', () => aboutModal.classList.add('hidden'));

btnAttach.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    messageInput.disabled = true;
    messageInput.style.opacity = '0.5';
    messageInput.value = '';
    messageInput.placeholder = "Image attached. Add key and send...";
    imagePreviewName.textContent = file.name;
    imagePreviewContainer.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.getElementById('hiddenCanvas');
            const ctx = canvas.getContext('2d');
            
            const MAX_WIDTH = 1000;
            let width = img.width;
            let height = img.height;
            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            selectedImageDataUrl = canvas.toDataURL('image/webp', 0.5); 
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

btnRemoveImage.addEventListener('click', clearImageSelection);

function clearImageSelection() {
    imageInput.value = "";
    selectedImageDataUrl = null;
    imagePreviewContainer.classList.add('hidden');
    messageInput.disabled = false;
    messageInput.style.opacity = '1';
    messageInput.placeholder = "Type message or 5-digit code...";
}

messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight < 100 ? this.scrollHeight : 100) + 'px';
});

function getCurrentTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(text, type, isImage = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    
    if (isImage) {
        const img = document.createElement('img');
        img.src = text;
        msgDiv.appendChild(img);
        
        const downloadBtn = document.createElement('a');
        downloadBtn.href = text;
        downloadBtn.download = "Brocode_Decrypted_Image.webp";
        downloadBtn.className = "download-btn";
        downloadBtn.innerHTML = "📥 Download Image";
        msgDiv.appendChild(downloadBtn);
    } else {
        const textDiv = document.createElement('div');
        textDiv.className = 'msg-text';
        textDiv.textContent = text;
        msgDiv.appendChild(textDiv);

        msgDiv.style.cursor = 'pointer';
        msgDiv.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(text);
                showToast();
            } catch (err) {}
        });
    }
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'msg-time';
    timeDiv.textContent = getCurrentTime();
    msgDiv.appendChild(timeDiv);

    chatArea.appendChild(msgDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function showToast() {
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToBuffer(base64) {
    const binary_string = window.atob(base64);
    const bytes = new Uint8Array(binary_string.length);
    for (let i = 0; i < binary_string.length; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

async function getDerivedKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
}

async function encryptData(textOrDataUrl, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getDerivedKey(password, salt);
    
    const cipherText = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, key, enc.encode(textOrDataUrl)
    );

    const payload = new Uint8Array(16 + 12 + cipherText.byteLength);
    payload.set(salt, 0); payload.set(iv, 16); payload.set(new Uint8Array(cipherText), 28);
    return bufferToBase64(payload.buffer);
}

async function decryptData(base64Payload, password) {
    try {
        const payload = new Uint8Array(base64ToBuffer(base64Payload));
        const salt = payload.slice(0, 16);
        const iv = payload.slice(16, 28);
        const cipherText = payload.slice(28);

        const key = await getDerivedKey(password, salt);
        const decryptedContent = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv }, key, cipherText
        );
        return dec.decode(decryptedContent);
    } catch (e) {
        throw new Error("Decryption failed. Invalid data or wrong key.");
    }
}

async function uploadToCloud(scrambledData) {
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    await set(ref(db, 'messages/' + shortId), {
        data: scrambledData,
        timestamp: Date.now()
    });
    return shortId;
}

async function downloadFromCloud(shortId) {
    const snapshot = await get(child(ref(db), `messages/${shortId.toUpperCase()}`));
    if (snapshot.exists()) return snapshot.val().data;
    throw new Error("Cloud message not found or expired.");
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    const key = cryptoKey.value.trim();
    const mode = cryptoMode.value;

    if ((!text && !selectedImageDataUrl) || !key) return;

    messageInput.value = '';
    messageInput.style.height = 'auto';

    try {
        if (mode === 'encrypt') {
            if (selectedImageDataUrl) {
                addMessage("📷 [Image Attached]", 'msg-sent');
                const encryptedImage = await encryptData(selectedImageDataUrl, key);
                const shareCode = await uploadToCloud(encryptedImage);
                addMessage("Image Encrypted! Tap the code below to copy.", 'msg-received');
                addMessage(shareCode, 'msg-received');
                clearImageSelection();
            } else {
                addMessage(text, 'msg-sent');
                const resultText = await encryptData(text, key);
                addMessage(resultText, 'msg-received');
            }
        } 
        else {
            addMessage(text, 'msg-sent');
            if (text.length === 5) {
                const cloudData = await downloadFromCloud(text);
                const decryptedData = await decryptData(cloudData, key);
                addMessage(decryptedData, 'msg-received', true);
            } else {
                const resultText = await decryptData(text, key);
                addMessage(resultText, 'msg-received');
            }
        }
    } catch (err) {
        addMessage(`Error: ${err.message}`, 'msg-received msg-error');
    }
});