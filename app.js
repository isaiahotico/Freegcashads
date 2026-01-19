
// --- FIREBASE SETUP ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- STATE ---
const tg = window.Telegram?.WebApp;
const userId = tg?.initDataUnsafe?.user?.id?.toString() || "dev_user";
const username = tg?.initDataUnsafe?.user?.username || "Guest_" + userId.slice(0,4);
let currentBal = 0;
let lastChat = 0;

// --- INITIALIZATION ---
function init() {
    document.getElementById('uName').innerText = "👤 " + username;
    document.getElementById('myUser').innerText = username;
    
    // Live User Data Sync
    db.collection('users').doc(userId).onSnapshot(doc => {
        if(doc.exists) {
            const data = doc.data();
            currentBal = data.balance || 0;
            document.getElementById('uBal').innerText = "₱" + currentBal.toFixed(3);
            document.getElementById('refCount').innerText = data.refCount || 0;
            document.getElementById('refBonus').innerText = "₱" + (data.bonusClaimable || 0).toFixed(2);
        } else {
            db.collection('users').doc(userId).set({ username, balance: 0, totalEarned: 0, bonusClaimable: 0, refCount: 0 });
        }
    });

    loadWithdrawals();
    loadLeaderboard();
    loadChat();
    syncGlobalStats();
}

// --- NAVIGATION ---
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// --- WITHDRAWAL SYSTEM ---
function toggleWFields() {
    const method = document.getElementById('wMethod').value;
    const amt = document.getElementById('wAmt').value;
    if(method === 'faucet') {
        document.getElementById('usdtConvert').innerText = "≈ " + (amt * 0.018).toFixed(4) + " USDT";
    } else {
        document.getElementById('usdtConvert').innerText = "";
    }
}

async function submitWithdraw() {
    const method = document.getElementById('wMethod').value;
    const addr = document.getElementById('wAddr').value;
    const amt = parseFloat(document.getElementById('wAmt').value);

    if(amt > currentBal || amt <= 0) return alert("Invalid Amount");

    await db.collection('withdrawals').add({
        userId, username, method, address: addr, amount: amt,
        status: 'pending', timestamp: Date.now()
    });

    await db.collection('users').doc(userId).update({
        balance: firebase.firestore.FieldValue.increment(-amt)
    });
    alert("Withdrawal Requested!");
}

function loadWithdrawals() {
    db.collection('withdrawals').where('userId', '==', userId).orderBy('timestamp', 'desc').limit(10).onSnapshot(snap => {
        let html = `<table><tr><th>Method</th><th>Amount</th><th>Status</th></tr>`;
        snap.forEach(doc => {
            const d = doc.data();
            html += `<tr><td>${d.method}</td><td>₱${d.amount}</td><td class="status-${d.status}">${d.status}</td></tr>`;
        });
        document.getElementById('wHistory').innerHTML = html + `</table>`;
    });
}

// --- ADMIN DASHBOARD ---
function openAdmin() {
    const pass = prompt("Enter Admin Password:");
    if(pass === "Propetas6") {
        showPage('p-admin');
        db.collection('withdrawals').orderBy('status', 'desc').onSnapshot(snap => {
            let html = `<table><tr><th>User</th><th>Amt</th><th>Action</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                if(d.status === 'pending') {
                    html += `<tr><td>${d.username}</td><td>₱${d.amount}</td>
                    <td><button onclick="updateStatus('${doc.id}', 'approved', ${d.amount})">✔</button>
                    <button onclick="updateStatus('${doc.id}', 'denied', 0)">✖</button></td></tr>`;
                }
            });
            document.getElementById('admin-list').innerHTML = html + `</table>`;
        });
    }
}

async function updateStatus(id, status, amt) {
    await db.collection('withdrawals').doc(id).update({ status });
    if(status === 'approved') {
        db.collection('globals').doc('stats').update({ totalPaid: firebase.firestore.FieldValue.increment(amt) });
    }
}

// --- REFERRAL SYSTEM ---
async function setReferrer() {
    const refName = document.getElementById('refInput').value;
    // Logic to find user by username and increment their refCount
    const refSnap = await db.collection('users').where('username', '==', refName).get();
    if(!refSnap.empty) {
        const refId = refSnap.docs[0].id;
        await db.collection('users').doc(userId).update({ referredBy: refId });
        await db.collection('users').doc(refId).update({ refCount: firebase.firestore.FieldValue.increment(1) });
        alert("Referrer Linked!");
    }
}

// --- CHAT SYSTEM ---
async function sendChat() {
    const now = Date.now();
    if(now - lastChat < 240000) return alert("Wait 4 minutes!");
    
    const msg = document.getElementById('chatInput').value;
    if(!msg) return;

    // Force Ad
    show_10276123().then(async () => {
        await db.collection('chats').add({ username, msg, timestamp: now });
        await db.collection('users').doc(userId).update({ balance: firebase.firestore.FieldValue.increment(0.02) });
        document.getElementById('chatInput').value = "";
        lastChat = now;
    });
}

function loadChat() {
    db.collection('chats').orderBy('timestamp', 'desc').limit(50).onSnapshot(snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = snap.docs.map(d => `<div class="msg"><b>${d.data().username}:</b> ${d.data().msg}</div>`).join('');
    });
}

// --- LEADERBOARD ---
function loadLeaderboard() {
    db.collection('users').orderBy('totalEarned', 'desc').limit(10).onSnapshot(snap => {
        let html = "";
        let i = 1;
        snap.forEach(doc => {
            html += `<tr><td>${i++}</td><td>${doc.data().username}</td><td>₱${doc.data().totalEarned.toFixed(2)}</td></tr>`;
        });
        document.querySelector('#leaderTable tbody').innerHTML = html;
    });
}

function syncGlobalStats() {
    db.collection('globals').doc('stats').onSnapshot(doc => {
        if(doc.exists) document.getElementById('totalPaid').innerText = "₱" + doc.data().totalPaid;
    });
}

init();
