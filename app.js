import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, orderBy, 
    limit, onSnapshot, serverTimestamp, where, startAfter, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Telegram Setup
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { first_name: "Guest", username: "anonymous" };
document.getElementById('user-name').innerText = ${user.first_name} (@${user.username});

// Chat Logic Vars
const chatContainer = document.getElementById('chat-container');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const loadMoreBtn = document.getElementById('load-more');

let lastVisible = null;
const MSG_LIMIT = 20;
const THREE_DAYS_AGO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

// --- 1. SEND MESSAGE ---
async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    try {
        await addDoc(collection(db, "messages"), {
            uid: user.id || 0,
            username: user.username || user.first_name,
            text: text,
            timestamp: serverTimestamp()
        });
        msgInput.value = "";
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (e) {
        console.error("Error adding document: ", e);
    }
}

// --- 2. RENDER MESSAGE ---
function renderMessage(doc, prepend = false) {
    const data = doc.data();
    if (!data.timestamp) return; // Skip messages being sent

    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = 
        <span class="user">${data.username}</span>
        <span class="text">${data.text}</span>
        <span class="time">${data.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    ;
    
    if (prepend) {
        chatContainer.prepend(div);
    } else {
        chatContainer.appendChild(div);
    }
}

// --- 3. LIVE LISTEN (Last 20 messages, 3-day filter) ---
const qLive = query(
    collection(db, "messages"),
    where("timestamp", ">=", THREE_DAYS_AGO),
    orderBy("timestamp", "desc"),
    limit(MSG_LIMIT)
);

onSnapshot(qLive, (snapshot) => {
    chatContainer.innerHTML = ""; // Clear for fresh load
    const docs = snapshot.docs.reverse(); // Newest at bottom
    docs.forEach(doc => renderMessage(doc));
    
    if (!lastVisible) {
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
});

// --- 4. PAGINATION (Load Older) ---
loadMoreBtn.onclick = async () => {
    if (!lastVisible) return;

    const qMore = query(
        collection(db, "messages"),
        where("timestamp", ">=", THREE_DAYS_AGO),
        orderBy("timestamp", "desc"),
        startAfter(lastVisible),
        limit(MSG_LIMIT)
    );

    const snapshot = await getDocs(qMore);
    if (snapshot.empty) {
        loadMoreBtn.innerText = "No more messages";
        return;
    }
    lastVisible = snapshot.docs[snapshot.docs.length - 1];
    snapshot.docs.forEach(doc => renderMessage(doc, true)); // Prepend older
};

// --- EVENTS ---
sendBtn.onclick = sendMessage;
msgInput.onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };

// Ad Reward Simulation
document.getElementById('watch-ad-btn').onclick = () => {
    tg.showConfirm("Watch video to earn 50 tokens?", (res) => {
        if(res) tg.showAlert("Reward added to " + user.username);
    });
