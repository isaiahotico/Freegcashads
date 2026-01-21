ChatGPT | Midjourney:
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Telegram WebApp Init
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: "Guest", first_name: "User_" + Math.floor(Math.random() * 1000) };
const userId = String(user.id);

// Local State
let currentBalance = 0;

// 1. Load/Create User
async function initUser() {
    const userRef = doc(db, "users", userId);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        await setDoc(userRef, {
            username: user.first_name,
            balance: 0,
            totalAds: 0,
            lastSeen: serverTimestamp()
        });
    }

    onSnapshot(userRef, (doc) => {
        const data = doc.data();
        currentBalance = data.balance || 0;
        document.getElementById('user-balance').innerText = `₱${currentBalance.toFixed(2)}`;
    });
}

// 2. Watch Ad Logic
window.watchAd = function() {
    // Show Monetag Rewarded Interstitial
    show_10276123().then(async () => {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            balance: increment(0.01),
            totalAds: increment(1)
        });
        tg.showAlert("Success! You earned ₱0.01");
    }).catch(e => {
        tg.showAlert("Ad failed to load. Please try again.");
    });
}

// 3. Chat Logic
window.sendMessage = async function() {
    const input = document.getElementById('chat-input');
    if (input.value.trim() === "") return;

    await addDoc(collection(db, "messages"), {
        uid: userId,
        name: user.first_name,
        text: input.value,
        createdAt: serverTimestamp()
    });
    input.value = "";
}

function loadChat() {

    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(20));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('chat-messages');
        container.innerHTML = "";
        snapshot.docs.reverse().forEach(doc => {
            const m = doc.data();
            container.innerHTML += `<div class="bg-slate-700 p-2 rounded-lg">
                <span class="font-bold text-emerald-400">${m.name}:</span> ${m.text}
            </div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

// 4. Leaderboard Logic
function loadLeaderboard() {
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(10));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        snapshot.docs.forEach((doc, index) => {
            const u = doc.data();
            list.innerHTML += `
                <div class="flex justify-between items-center p-2 bg-slate-700 rounded-lg">
                    <span>${index + 1}. ${u.username}</span>
                    <span class="font-bold text-emerald-400">₱${u.balance.toFixed(2)}</span>
                </div>`;
        });
    });
}

// 5. Withdrawal Logic
window.requestWithdrawal = async function() {
    const gcash = document.getElementById('gcash-number').value;
    const amount = parseFloat(document.getElementById('withdraw-amount').value);

    if (amount < 0.02) return tg.showAlert("Minimum withdrawal is ₱0.02");
    if (amount > currentBalance) return tg.showAlert("Insufficient balance!");
    if (gcash.length < 10) return tg.showAlert("Enter valid GCash number");

    await updateDoc(doc(db, "users", userId), {
        balance: increment(-amount)
    });

    await addDoc(collection(db, "withdrawals"), {
        userId,
        username: user.first_name,
        gcash,
        amount,
        status: "pending",
        createdAt: serverTimestamp()
    });

    tg.showAlert("Withdrawal requested! Please wait 24-48 hours.");
}

// Initialize everything
initUser();
loadChat();
loadLeaderboard();
