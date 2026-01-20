
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc, increment, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// State
const tg = window.Telegram?.WebApp;
const tgUser = tg?.initDataUnsafe?.user;
const myUsername = tgUser ? (tgUser.username || tgUser.first_name) : "Guest_" + Math.random().toString(36).substr(2, 5);
let myData = { balance: 0, role: 'user' };
let adminPage = 1, userPage = 1;

/* ================= ADMIN LOGIC ================= */
async function initAdminCheck() {
    const isFirstTime = !localStorage.getItem('visited_v8');
    const uRef = doc(db, "users", myUsername);
    const snap = await getDoc(uRef);
    
    if (snap.exists() && snap.data().role === 'admin') {
        document.getElementById('admin-nav').style.display = 'block';
    } else if (isFirstTime) {
        document.getElementById('admin-popup').classList.remove('hidden');
    }
    localStorage.setItem('visited_v8', 'true');
}

window.checkAdminCode = async () => {
    const code = document.getElementById('admin-code-input').value;
    if (code === "Propetas12") {
        const statsRef = doc(db, "stats", "admins");
        const statsSnap = await getDoc(statsRef);
        const count = statsSnap.exists() ? statsSnap.data().count : 0;

        if (count < 2) {
            await setDoc(statsRef, { count: increment(1) }, { merge: true });
            await updateDoc(doc(db, "users", myUsername), { role: 'admin' });
            alert("Admin access granted!");
            location.reload();
        } else {
            alert("Admin seats are full!");
            closeAdminPopup();
        }
    } else {
        alert("Invalid code.");
    }
};

window.closeAdminPopup = () => document.getElementById('admin-popup').classList.add('hidden');

/* ================= AD REWARDS (COMBINED) ================= */
window.watchCombinedAds = async () => {
    const now = Date.now();
    const lastAd = myData.lastAdClaim || 0;
    if (now - lastAd < 300000) return alert("Cooldown: 5 minutes");

    try {
        await show_10337853();
        await show_10276123();
        await show_10337795();

        await updateDoc(doc(db, "users", myUsername), { 
            balance: increment(0.015), 
            lastAdClaim: now 
        });
        showRandomGreeting();
    } catch (e) { console.error("Ad failed", e); }
};

function showRandomGreeting() {
    const greets = [
        { t: "🌟 BRILLIANT!", m: "You are a top earner!" },
        { t: "💎 UNSTOPPABLE!", m: "Your balance is growing fast!" },
        { t: "🚀 MISSION SUCCESS!", m: "Reward successfully claimed!" }
    ];
    const pick = greets[Math.floor(Math.random() * greets.length)];
    document.getElementById('greeting-title').innerText = pick.t;
    document.getElementById('greeting-msg').innerText = pick.m;
    document.getElementById('reward-popup').classList.remove('hidden');
}

window.closeRewardPopup = () => document.getElementById('reward-popup').classList.add('hidden');

/* ================= WITHDRAWALS & SYNC ================= */
window.handleWithdraw = async (type) => {
    const info = document.getElementById('payoutInfo').value;
    if (myData.balance < 0.02) return alert("Min: ₱0.02");
    if (!info) return alert("Enter account info");

    const wData = {
        username: myUsername,
        method: type,
        account: info,
        amount: myData.balance,
        status: "Pending",
        timestamp: serverTimestamp()
    };

    await addDoc(collection(db, "withdrawals"), wData);
    await updateDoc(doc(db, "users", myUsername), { balance: 0 });
    alert("Withdrawal submitted!");
};

// Sync User History
function syncUserHistory() {
    onSnapshot(query(collection(db, "withdrawals"), where("username", "==", myUsername), orderBy("timestamp", "desc")), (snap) => {
        const rows = snap.docs.map(d => d.data());
        renderTable('userHistBody', rows, userPage);
    });
}

// Sync Admin Panel
function syncAdminPanel() {
    onSnapshot(query(collection(db, "withdrawals"), orderBy("timestamp", "desc")), (snap) => {
        const container = document.getElementById('adminBody');
        container.innerHTML = snap.docs.slice((adminPage-1)*10, adminPage*10).map(d => {
            const data = d.data();
            return `<tr>
                <td>${data.username}</td>
                <td>${data.method}</td>
                <td>${data.account}</td>
                <td>₱${data.amount.toFixed(2)}</td>
                <td class="status-${data.status.toLowerCase()}">${data.status}</td>
                <td>${data.status === 'Pending' ? `<button onclick="approve('${d.id}')">Approve</button>` : 'Done'}</td>
            </tr>`;
        }).join('');
    });
}

window.approve = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "Approved" });
    alert("Approved!");
};

function renderTable(id, data, pg) {
    const start = (pg-1)*5;
    const body = document.getElementById(id);
    body.innerHTML = data.slice(start, start+5).map(row => `
        <tr>
            <td>${row.method}</td>
            <td>${row.account}</td>
            <td>₱${row.amount.toFixed(2)}</td>
            <td>${row.timestamp?.toDate().toLocaleDateString() || '...'}</td>
            <td class="status-${row.status.toLowerCase()}">${row.status}</td>
        </tr>
    `).join('');
}

/* ================= CORE SYSTEM ================= */
async function init() {
    document.getElementById('header-user').innerText = "@" + myUsername;

    const uRef = doc(db, "users", myUsername);
    const snap = await getDoc(uRef);
    if (!snap.exists()) await setDoc(uRef, { username: myUsername, balance: 0, role: 'user' });

    onSnapshot(uRef, (d) => {
        myData = d.data();
        document.getElementById('header-bal').innerText = myData.balance.toFixed(3);
        document.getElementById('earnBox').innerText = myData.balance.toFixed(3);
        
        // Cooldown Timer UI
        const last = myData.lastAdClaim || 0;
        const diff = Date.now() - last;
        if (diff < 300000) {
            document.getElementById('ad-btn').disabled = true;
            document.getElementById('ad-cd').innerText = Math.ceil((300000 - diff) / 60000) + "m";
        } else {
            document.getElementById('ad-btn').disabled = false;
            document.getElementById('ad-cd').innerText = "READY";
        }
    });

    initAdminCheck();
    syncUserHistory();
    syncAdminPanel();
}

window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

init();
