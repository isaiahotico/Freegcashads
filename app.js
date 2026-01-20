
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.floor(Math.random()*1000);
const userId = tgUser ? tgUser.id.toString() : "guest_id";

document.getElementById("userBar").innerText = "👤 User: " + username;

/* ================= APP STATE ================= */
let currentMode = 'elementary'; // or 'highschool'
let balance = 0.0;
let lastSentTime = 0;
let lastClaimTime = 0;

/* ================= DATABASE LOGIC ================= */

// Sync Balance
const userRef = doc(db, "users", userId);
onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
        balance = snap.data().balance || 0;
        document.getElementById("userBalance").innerText = `💰 ${balance.toFixed(3)} Peso`;
    } else {
        updateDoc(userRef, { balance: 0, username: username }, { merge: true });
    }
});

// Chat Synchronization
let unsubscribe = null;
function switchChat(mode) {
    currentMode = mode;
    document.getElementById('chatRoom').style.display = 'flex';
    document.getElementById('chatTitle').innerText = mode === 'elementary' ? "📘 ELEMENTARY CHAT" : "📗 HIGHSCHOOL CHAT";
    document.getElementById('messages-list').innerHTML = '';
    document.getElementById('highschoolClaim').style.display = 'none';

    if (unsubscribe) unsubscribe();

    const colName = mode === 'elementary' ? 'elementaryMessages' : 'highschoolMessages';
    const q = query(collection(db, colName), orderBy('timestamp', 'desc'), limit(50));

    unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = [];
        snapshot.forEach(doc => msgs.push(doc.data()));
        renderMessages(msgs.reverse());
    });
}

function renderMessages(msgs) {
    const list = document.getElementById('messages-list');
    list.innerHTML = msgs.map(m => `
        <div class="msg ${m.user === username ? 'msg-me' : 'msg-other'}">
            <small><b>${m.user}</b></small><br>${m.text}
        </div>
    `).join('');
    list.scrollTop = list.scrollHeight;
}

/* ================= AD LOGIC ================= */

async function showAdsSequence() {
    document.getElementById('loader').style.display = 'flex';
    try {
        // Sequentially showing 3 ads for highest CPM impact
        if(typeof show_10337853 === 'function') await show_10337853();
        if(typeof show_10337795 === 'function') await show_10337795();
        if(typeof show_10276123 === 'function') await show_10276123();
    } catch (e) {
        console.log("Ad skipped or failed, continuing flow...");
    }
    document.getElementById('loader').style.display = 'none';
}

/* ================= SEND LOGIC ================= */

document.getElementById('sendBtn').onclick = async () => {
    const text = document.getElementById('msgInput').value;
    const now = Date.now();

    if (!text) return;
    if (now - lastSentTime < 180000) { // 3 min cooldown
        alert("Cooldown active! Please wait.");
        return;
    }

    await showAdsSequence();

    if (currentMode === 'elementary') {
        // Elementary: Reward immediately
        await updateDoc(userRef, { balance: increment(0.015) });
    } else {
        // Highschool: Unlock claim button
        document.getElementById('highschoolClaim').style.display = 'block';
    }

    // Send Message
    const colName = currentMode === 'elementary' ? 'elementaryMessages' : 'highschoolMessages';
    await addDoc(collection(db, colName), {
        user: username,
        text: text,
        timestamp: serverTimestamp()
    });

    document.getElementById('msgInput').value = '';
    lastSentTime = now;
    startCooldown();
};

// Highschool Claim Logic
document.getElementById('claimBtn').onclick = async () => {
    const now = Date.now();
    if (now - lastClaimTime < 240000) { // 4 min cooldown
        alert("Claim cooldown active!");
        return;
    }
    
    await updateDoc(userRef, { balance: increment(0.015) });
    lastClaimTime = now;
    document.getElementById('highschoolClaim').style.display = 'none';
    alert("0.015 Peso added!");
};

/* ================= UTILS ================= */

function startCooldown() {
    const display = document.getElementById('cooldownDisplay');
    let timeLeft = 180;
    const timer = setInterval(() => {
        timeLeft--;
        display.innerText = `Next message in: ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            display.innerText = '';
        }
    }, 1000);
}

document.getElementById('btnElem').onclick = () => switchChat('elementary');
document.getElementById('btnHigh').onclick = () => switchChat('highschool');

// Initialize
switchChat('elementary');
