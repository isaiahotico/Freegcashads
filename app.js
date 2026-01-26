
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, addDoc, increment, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Telegram Username Detection
const tg = window.Telegram.WebApp;
const username = tg.initDataUnsafe?.user?.username || "Guest_" + Math.floor(Math.random() * 9999);
let uData = null;

// Initialize User
async function initUser() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, {
            username: username,
            balance: 0,
            points: 5,
            referrer: "",
            totalRefEarnings: 0
        });
    }

    document.getElementById('my-username').innerText = username;

    onSnapshot(userRef, (doc) => {
        uData = doc.data();
        document.getElementById('balance').innerText = uData.balance.toFixed(3);
        document.getElementById('points').innerText = uData.points;
        document.getElementById('ref-earned-display').innerText = (uData.totalRefEarnings || 0).toFixed(3);
    });

    syncLeaderboard();
    syncChat();
    syncPayouts();
}

// Navigation Logic
window.openTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    document.getElementById('nav-' + tabName).classList.add('active');
};

// ADS LOGIC
window.watchVideo = () => {
    if (isOnCD('video')) return;
    show_10276123().then(async () => {
        await updateDoc(doc(db, "users", username), { points: increment(1) });
        startCD('video', 20, 'btn-video');
    });
};

window.watchPopup = () => {
    if (isOnCD('popup')) return;
    show_10276123('pop').then(async () => {
        await updateDoc(doc(db, "users", username), { points: increment(1) });
        startCD('popup', 20, 'btn-popup');
    });
};

// CHAT LOGIC
window.sendChat = async () => {
    const msg = document.getElementById('chat-msg').value.trim();
    if (!msg || uData.points < 1 || isOnCD('chat')) return;

    // High CPM Interstitial
    show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0, interval: 0, timeout: 0, everyPage: true } });

    await updateDoc(doc(db, "users", username), { 
        balance: increment(0.015), 
        points: increment(-1) 
    });

    await addDoc(collection(db, "chat"), {
        username: username,
        text: msg,
        time: serverTimestamp()
    });

    // Referral 8% Bonus Auto-Credit
    if (uData.referrer) {
        const rRef = doc(db, "users", uData.referrer);
        const bonus = 0.015 * 0.08;
        await updateDoc(rRef, {
            balance: increment(bonus),
            totalRefEarnings: increment(bonus)
        });
    }

    document.getElementById('chat-msg').value = "";
    startCD('chat', 45, 'btn-chat');
};

function syncChat() {
    const q = query(collection(db, "chat"), orderBy("time", "desc"), limit(25));
    onSnapshot(q, (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.docs.reverse().forEach(d => {
            const data = d.data();
            const isMe = data.username === username;
            box.innerHTML += `
                <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                    <div class="${isMe ? 'bg-amber-100' : 'bg-gray-100'} p-3 rounded-2xl max-w-[80%] shadow-sm">
                        <p class="text-[9px] font-black text-amber-700 uppercase">@${data.username}</p>
                        <p class="text-sm text-gray-800">${data.text}</p>
                    </div>
                </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// WITHDRAWAL LOGIC (Min 1 Peso)
window.requestPayout = async () => {
    const gcash = document.getElementById('gcash-acc').value;
    if (gcash.length < 10) return alert("Enter valid GCash Number");
    if (uData.balance < 1.0) return alert("Minimum withdrawal is ₱1.00");

    const amount = uData.balance; // Withdraw all balance
    await updateDoc(doc(db, "users", username), { balance: 0 });
    
    await addDoc(collection(db, "withdrawals"), {
        username: username,
        amount: amount,
        gcash: gcash,
        status: "Pending",
        time: serverTimestamp()
    });
    alert("₱" + amount.toFixed(2) + " requested successfully!");
};

function syncPayouts() {
    const q = query(collection(db, "withdrawals"), orderBy("time", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('payout-history');
        container.innerHTML = '<h3 class="text-xs font-bold text-gray-400 mb-2">RECENT WITHDRAWALS</h3>';
        snap.docs.forEach(d => {
            const data = d.data();
            container.innerHTML += `
                <div class="bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm text-[11px]">
                    <div><b>₱${data.amount.toFixed(2)}</b> to ${data.gcash}</div>
                    <div class="${data.status === 'Pending' ? 'text-orange-500' : 'text-green-500'} font-bold">${data.status}</div>
                </div>`;
        });
    });
}

// OWNER DASHBOARD LOGIC
window.verifyOwner = () => {
    if (document.getElementById('owner-key').value === "Propetas12") {
        document.getElementById('owner-login').classList.add('hidden');
        document.getElementById('owner-content').classList.remove('hidden');
        loadOwnerPanel();
    } else {
        alert("Incorrect Key");
    }
};

function loadOwnerPanel() {
    const q = query(collection(db, "withdrawals"), orderBy("time", "desc"));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('admin-list');
        list.innerHTML = "";
        snap.docs.forEach(d => {
            const data = d.data();
            if (data.status === "Pending") {
                list.innerHTML += `
                <div class="bg-white p-4 rounded-2xl shadow-md border-l-4 border-red-500">
                    <div class="flex justify-between mb-2">
                        <span class="font-black text-sm">@${data.username}</span>
                        <span class="text-blue-600 font-bold">₱${data.amount.toFixed(2)}</span>
                    </div>
                    <p class="text-xs text-gray-500 mb-3 font-mono">GCASH: ${data.gcash}</p>
                    <button onclick="markAsPaid('${d.id}')" class="w-full bg-green-500 text-white py-2 rounded-xl text-xs font-bold">MARK AS PAID</button>
                </div>`;
            }
        });
    });
}

window.markAsPaid = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "Paid" });
};

// UTILS
window.updateReferrer = async () => {
    const ref = document.getElementById('ref-input').value.trim();
    if (ref === username) return alert("Invalid Referrer");
    const check = await getDoc(doc(db, "users", ref));
    if (check.exists()) {
        await updateDoc(doc(db, "users", username), { referrer: ref });
        alert("Referral setup complete!");
    } else {
        alert("Referrer not found");
    }
};

function syncLeaderboard() {
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('leaderboard');
        list.innerHTML = "";
        let i = 1;
        snap.docs.forEach(d => {
            const data = d.data();
            list.innerHTML += `
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                    <span class="text-xs font-bold text-gray-400">#${i++}</span>
                    <span class="flex-1 ml-3 text-xs font-bold">@${data.username}</span>
                    <span class="text-xs font-black text-blue-600">₱${data.balance.toFixed(2)}</span>
                </div>`;
        });
    });
}

function startCD(type, sec, id) {
    const btn = document.getElementById(id);
    btn.classList.add('cooldown');
    const expiry = Date.now() + (sec * 1000);
    localStorage.setItem('cd_' + type, expiry);
    
    let ticker = setInterval(() => {
        const diff = Math.ceil((expiry - Date.now()) / 1000);
        if (type === 'chat') document.getElementById('chat-cooldown-timer').innerText = diff + "s CD";
        if (diff <= 0) {
            clearInterval(ticker);
            btn.classList.remove('cooldown');
            if (type === 'chat') document.getElementById('chat-cooldown-timer').innerText = "";
        }
    }, 1000);
}

function isOnCD(type) {
    const exp = localStorage.getItem('cd_' + type);
    if (exp && Date.now() < exp) {
        alert("Please wait for cooldown");
        return true;
    }
    return false;
}

initUser();
