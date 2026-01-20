
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, addDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp, increment, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase, ref, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- Firebase Config ---
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
const rtdb = getDatabase(app);

// --- Real-time Telegram Identity Handling ---
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user || { id: "guest", first_name: "Guest", last_name: "User", username: "unknown" };
const userId = String(tgUser.id);
const realFullName = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim();
const realUsername = tgUser.username ? `@${tgUser.username}` : "No Username";

// Immediate Live Update to UI
document.getElementById('display-name').innerText = realFullName;
document.getElementById('display-username').innerText = realUsername;

let balance = 0;
let currentChatType = 'elementary';

// --- Ad Configurations ---
const adRotationConfig = [10337853, 10276123, 10337795];
let rotationIndex = 0;

// --- Initialize User & Sync Name ---
async function syncUserIdentity() {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    const userData = {
        fullName: realFullName,
        username: realUsername,
        lastActive: Date.now()
    };

    if (!userSnap.exists()) {
        await setDoc(userRef, {
            ...userData,
            balance: 0,
            firstWithdrawalDone: false,
            giftCooldowns: { gift1: 0, gift2: 0, gift3: 0 },
            createdAt: serverTimestamp()
        });
    } else {
        // Update name in DB if it changed in Telegram
        await updateDoc(userRef, userData);
        balance = userSnap.data().balance || 0;
        updateBalanceUI();
    }
}

// --- Automatic Interstitials (Every 3 minutes, 6 min session) ---
function startAutoAds() {
    setInterval(async () => {
        const zoneId = adRotationConfig[rotationIndex];
        const adFunc = window[`show_${zoneId}`];
        
        if (typeof adFunc === 'function') {
            console.log(`Auto-rotating ad: ${zoneId}`);
            adFunc({
                type: 'inApp',
                inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
            });
            rotationIndex = (rotationIndex + 1) % adRotationConfig.length;
        }
    }, 180000); // 3 Minutes
}

// --- Paper House Gift Logic (Update 5) ---
window.handleGiftAd = async (giftId, zoneId) => {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    const lastClaim = snap.data()?.giftCooldowns?.[giftId] || 0;
    const now = Date.now();

    if (now < lastClaim) {
        alert("Wait for 3 hours cooldown!");
        return;
    }

    const adFunc = window[`show_${zoneId}`];
    updateButton(giftId, "Loading Ad...", true);

    adFunc('pop').then(() => {
        document.getElementById(`btn-${giftId}`).classList.add('hidden');
        document.getElementById(`claim-${giftId}`).classList.remove('hidden');
    }).catch(() => {
        alert("Ad failed. Try again.");
        updateButton(giftId, "Watch Ad to Unlock", false);
    });
};

window.claimGift = async (giftId) => {
    const userRef = doc(db, "users", userId);
    const threeHours = 3 * 60 * 60 * 1000;

    await updateDoc(userRef, {
        balance: increment(0.01),
        [`giftCooldowns.${giftId}`]: Date.now() + threeHours
    });

    balance += 0.01;
    updateBalanceUI();
    router('home');
    alert("0.01 PHP Claimed!");
};

// --- Navigation & Core Logic ---
window.router = (path) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`page-${path}`)?.classList.remove('hidden');
    if (path === 'elementary' || path === 'highschool' || path === 'college') {
        currentChatType = path;
        loadChat();
    }
    if (path === 'gifts') updateGiftCooldowns();
};

async function updateGiftCooldowns() {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    const cooldowns = snap.data()?.giftCooldowns || {};
    const now = Date.now();

    ['gift1', 'gift2', 'gift3'].forEach(id => {
        const remaining = (cooldowns[id] || 0) - now;
        const display = document.getElementById(`cooldown-${id}`);
        const btn = document.getElementById(`btn-${id}`);
        const claim = document.getElementById(`claim-${id}`);

        if (remaining > 0) {
            display.innerText = `Ready in: ${Math.ceil(remaining/60000)} mins`;
            btn.disabled = true;
            btn.classList.add('opacity-50');
        } else {
            display.innerText = "Ready to claim!";
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'hidden');
            claim.classList.add('hidden');
        }
    });
}

function updateBalanceUI() {
    document.getElementById('balance').innerText = balance.toFixed(3);
}

function updateButton(giftId, text, disabled) {
    const btn = document.getElementById(`btn-${giftId}`);
    btn.innerText = text;
    btn.disabled = disabled;
}

// --- Chat Logic ---
async function loadChat() {
    const q = query(collection(db, `chat_${currentChatType}`), orderBy("createdAt", "desc"), limit(20));
    onSnapshot(q, (snap) => {
        document.getElementById('chatBox').innerHTML = snap.docs.map(d => `
            <div class="mb-2 p-2 bg-white rounded-lg shadow-sm border-l-4 border-indigo-500">
                <p class="text-[9px] font-bold text-gray-500">${d.data().user}</p>
                <p class="text-sm">${d.data().text}</p>
            </div>
        `).join('');
    });
}

// Start App
syncUserIdentity();
startAutoAds();
setInterval(() => document.getElementById('footerClock').innerText = new Date().toLocaleTimeString(), 1000);
