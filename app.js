
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, addDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Telegram User Identity ---
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
const user = tg?.initDataUnsafe?.user || { id: "0000", first_name: "Guest", last_name: "User", username: "guest" };
const userId = String(user.id);
const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
const username = user.username ? `@${user.username}` : "No Username";

// Elements
const balanceEl = document.getElementById('balance-display');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');

let currentRoom = "elementary";
let chatUnsub = null;

// --- INITIALIZE & LIVE SYNC ---
async function init() {
    document.getElementById('user-fullname').innerText = fullName;
    document.getElementById('user-username').innerText = username;

    const userRef = doc(db, "users", userId);
    
    // Live Balance & Cooldown Listener
    onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            balanceEl.innerText = (data.balance || 0).toFixed(3);
            updateGiftUI(data.giftCooldowns || {});
        } else {
            setDoc(userRef, { fullName, username, balance: 0, giftCooldowns: {} });
        }
    });

    startAutoInterstitials();
}

// --- INSTANT ROUTING ---
window.router = (path) => {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    
    if (path === 'elementary' || path === 'highschool' || path === 'college') {
        currentRoom = path;
        document.getElementById('chat-title').innerText = path.toUpperCase();
        document.getElementById('page-chat').classList.add('active');
        setupLiveChat();
    } else if (path === 'leaderboard') {
        document.getElementById('page-leaderboard').classList.add('active');
        setupLiveLeaderboard();
    } else {
        document.getElementById(`page-${path}`).classList.add('active');
    }
};

// --- LIVE CHAT ---
function setupLiveChat() {
    if (chatUnsub) chatUnsub();
    const q = query(collection(db, `chat_${currentRoom}`), orderBy("createdAt", "desc"), limit(30));
    chatUnsub = onSnapshot(q, (snap) => {
        chatBox.innerHTML = snap.docs.map(d => `
            <div class="p-2 glass rounded-xl animate__animated animate__fadeInUp">
                <p class="text-[9px] font-black text-indigo-500">${d.data().user}</p>
                <p class="text-sm">${d.data().text}</p>
            </div>
        `).join('');
    });
}

document.getElementById('chat-send-btn').onclick = async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    // Ad sequence
    const ads = [window.show_10337853, window.show_10337795, window.show_10276123];
    for (let ad of ads) await ad('pop');

    await addDoc(collection(db, `chat_${currentRoom}`), {
        user: username,
        text: text,
        createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "users", userId), { balance: increment(0.015) });
    chatInput.value = "";
};

// --- PAPER HOUSE GIFTS ---
window.runGiftAd = async (giftId, zone) => {
    const adFunc = window[`show_${zone}`];
    await adFunc('pop');
    document.getElementById(`${giftId}-ad`).classList.add('hidden');
    document.getElementById(`${giftId}-claim`).classList.remove('hidden');
};

window.claimGift = async (giftId) => {
    const nextClaim = Date.now() + (3 * 60 * 60 * 1000);
    await updateDoc(doc(db, "users", userId), {
        balance: increment(0.01),
        [`giftCooldowns.${giftId}`]: nextClaim
    });
    alert("Reward Claimed!");
};

function updateGiftUI(cooldowns) {
    const now = Date.now();
    ['gift1', 'gift2', 'gift3'].forEach(id => {
        const cd = cooldowns[id] || 0;
        const timer = document.getElementById(`${id}-timer`);
        const adBtn = document.getElementById(`${id}-ad`);
        const claimBtn = document.getElementById(`${id}-claim`);

        if (now < cd) {
            const mins = Math.ceil((cd - now) / 60000);
            timer.innerText = `Cooldown: ${mins} mins`;
            adBtn.disabled = true;
            adBtn.classList.add('opacity-50');
            claimBtn.classList.add('hidden');
        } else {
            timer.innerText = "Available Now!";
            adBtn.disabled = false;
            adBtn.classList.remove('opacity-50', 'hidden');
        }
    });
}

// --- AUTO ADS ---
function startAutoInterstitials() {
    const zones = [10337853, 10337795, 10276123];
    let idx = 0;
    setInterval(() => {
        const ad = window[`show_${zones[idx]}`];
        ad({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5 } });
        idx = (idx + 1) % zones.length;
    }, 180000); // 3 minutes
}

// --- LEADERBOARD ---
function setupLiveLeaderboard() {
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(20));
    onSnapshot(q, (snap) => {
        document.getElementById('leaderboard-list').innerHTML = snap.docs.map((d, i) => `
            <div class="flex justify-between p-4">
                <span>${i + 1}. ${d.data().username}</span>
                <span class="font-bold">${(d.data().balance || 0).toFixed(3)} PHP</span>
            </div>
        `).join('');
    });
}

init();
