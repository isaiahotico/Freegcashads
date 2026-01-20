
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

const tg = window.Telegram?.WebApp;
const rawUser = tg?.initDataUnsafe?.user?.username || tg?.initDataUnsafe?.user?.first_name || "Guest";
const userDocId = rawUser.replace(/\s+/g, '_');

let uData = { balance: 0, referralBonus: 0, cooldowns: {} };
let userCursor = null, adminCursor = null;

function init() {
    document.getElementById('uName').innerText = "👤 " + userDocId;
    document.getElementById('myId').innerText = userDocId;

    db.collection('users').doc(userDocId).onSnapshot(doc => {
        if(doc.exists) {
            uData = doc.data();
            document.getElementById('uBal').innerText = "₱" + (uData.balance || 0).toFixed(3);
            document.getElementById('refCount').innerText = uData.refCount || 0;
            document.getElementById('refBonus').innerText = "₱" + (uData.referralBonus || 0).toFixed(3);
        } else {
            db.collection('users').doc(userDocId).set({ balance: 0, totalEarned: 0, refCount: 0, referralBonus: 0, cooldowns: {} });
        }
    });

    renderTasks();
    loadChat();
    loadLeaders();
    loadUserHistory();
}

function renderTasks() {
    const sets = [
        { div: 'list-ads', type: 'ads', count: 3, cd: 300, ids: [10276123, 10337795, 10337853] },
        { div: 'list-signin', type: 'signin', count: 3, cd: 10800, ids: [10276123, 10337795, 10337853] },
        { div: 'list-gift', type: 'gift', count: 3, cd: 10800, ids: [10276123, 10337795, 10337853], pop: true },
        { div: 'list-quick', type: 'quick', count: 3, cd: 60, ids: [10276123, 10337795, 10337853] }
    ];

    sets.forEach(s => {
        let h = '';
        for(let i=1; i<=s.count; i++) {
            h += `<div class="card"><b>${s.type.toUpperCase()} #${i}</b><br>
            <button class="btn" id="btn-${s.type}-${i}" onclick="claimAd('${s.type}', ${i}, ${s.ids[i-1]}, ${s.cd}, ${s.pop || false})">Watch (₱0.01)</button>
            <div id="tm-${s.type}-${i}" style="font-size:10px; color:red;">Ready</div></div>`;
        }
        document.getElementById(s.div).innerHTML = h;
    });
}

async function claimAd(type, id, zone, cd, isPop) {
    const key = `${type}_${id}`;
    if(uData.cooldowns?.[key] > Date.now()) return alert("Cooldown active!");

    try {
        if(isPop) await window["show_"+zone]('pop'); else await window["show_"+zone]();

        const newCDs = {...(uData.cooldowns || {})};
        newCDs[key] = Date.now() + (cd * 1000);

        await db.collection('users').doc(userDocId).update({
            balance: firebase.firestore.FieldValue.increment(0.01),
            totalEarned: firebase.firestore.FieldValue.increment(0.01),
            cooldowns: newCDs
        });

        // Referral Bonus Logic: 10% (0.001) to the referrer
        if(uData.referredBy) {
            db.collection('users').doc(uData.referredBy).update({
                referralBonus: firebase.firestore.FieldValue.increment(0.001)
            });
        }
        alert("Success! ₱0.01 added.");
    } catch(e) { alert("Ad Failed."); }
}

// --- Withdrawal Pagination ---
async function loadUserHistory(startAfterDoc = null) {
    let query = db.collection('withdrawals').where('user', '==', userDocId).orderBy('time', 'desc').limit(15);
    if(startAfterDoc) query = query.startAfter(startAfterDoc);

    query.onSnapshot(snap => {
        if(snap.empty) return;
        userCursor = snap.docs[snap.docs.length-1];
        let h = '<table><tr><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr>';
        snap.forEach(d => {
            const data = d.data();
            h += `<tr><td>${data.method}</td><td>₱${data.amt}</td><td class="status-${data.status}">${data.status}</td><td>${new Date(data.time).toLocaleDateString()}</td></tr>`;
        });
        document.getElementById('wHistoryTable').innerHTML = h + '</table>';
    });
}

async function submitWithdraw() {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const addr = document.getElementById('wAddr').value;
    const method = document.getElementById('wMethod').value;
    if(amt > uData.balance || amt < 1) return alert("Invalid Amount");

    await db.collection('withdrawals').add({
        user: userDocId, amt, addr, method, status: 'pending', time: Date.now()
    });
    await db.collection('users').doc(userDocId).update({ balance: firebase.firestore.FieldValue.increment(-amt) });
    alert("Withdrawal Requested!");
}

// --- Admin ---
function checkAdmin() {
    if(prompt("Pass:") === "Propetas6") {
        showPage('p-admin');
        loadAdminHistory();
    }
}

function loadAdminHistory(startAfterDoc = null) {
    let query = db.collection('withdrawals').orderBy('time', 'desc').limit(15);
    if(startAfterDoc) query = query.startAfter(startAfterDoc);

    query.onSnapshot(snap => {
        adminCursor = snap.docs[snap.docs.length-1];
        let h = '<table><tr><th>Name</th><th>Method</th><th>Amt</th><th>Status</th><th>Action</th></tr>';
        snap.forEach(d => {
            const data = d.data();
            h += `<tr><td>${data.user}</td><td>${data.method}</td><td>₱${data.amt}</td><td>${data.status}</td>
            <td><button onclick="approveW('${d.id}')">✔</button></td></tr>`;
        });
        document.getElementById('adminTable').innerHTML = h + '</table>';
    });
}

async function approveW(id) { await db.collection('withdrawals').doc(id).update({ status: 'approved' }); }

// --- Referrals ---
async function linkRef() {
    const rName = document.getElementById('refInput').value.trim();
    if(rName === userDocId) return alert("Cannot link yourself");
    const refSnap = await db.collection('users').doc(rName).get();
    if(refSnap.exists) {
        await db.collection('users').doc(userDocId).update({ referredBy: rName });
        await db.collection('users').doc(rName).update({ refCount: firebase.firestore.FieldValue.increment(1) });
        alert("Referrer Linked!");
    } else alert("User not found");
}

async function claimRef() {
    if(uData.referralBonus < 0.01) return alert("Min claim ₱0.01");
    const b = uData.referralBonus;
    await db.collection('users').doc(userDocId).update({
        balance: firebase.firestore.FieldValue.increment(b),
        referralBonus: 0
    });
}

// --- Helpers ---
function updateWUI() {
    const a = document.getElementById('wAmt').value;
    const m = document.getElementById('wMethod').value;
    document.getElementById('convertText').innerText = m === 'faucetpay' ? `≈ ${(a*0.017).toFixed(4)} USDT` : "";
}

function showPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(p).classList.add('active');
}

function loadChat() {
    db.collection('messages').orderBy('time', 'desc').limit(50).onSnapshot(snap => {
        document.getElementById('chat-box').innerHTML = snap.docs.map(d => `<div class="msg"><b>${d.data().user}:</b> ${d.data().text}</div>`).join('');
    });
}

async function sendChat() {
    const t = document.getElementById('chatInput').value;
    if(!t) return;
    await window.show_10276123();
    await db.collection('messages').add({ user: userDocId, text: t, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

function loadLeaders() {
    db.collection('users').orderBy('totalEarned', 'desc').limit(10).onSnapshot(snap => {
        document.querySelector('#leadTable tbody').innerHTML = snap.docs.map(d => `<tr><td>${d.id}</td><td>₱${d.data().totalEarned.toFixed(2)}</td></tr>`).join('');
    });
}

function nextPage(type) { if(type==='user') loadUserHistory(userCursor); else loadAdminHistory(adminCursor); }

setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('[id^="tm-"]').forEach(el => {
        const key = el.id.replace('tm-', '').replace('-', '_');
        const target = uData.cooldowns?.[key] || 0;
        if(target > now) {
            el.innerText = `Wait ${Math.ceil((target-now)/1000)}s`;
            el.previousElementSibling.disabled = true;
        } else {
            el.innerText = "Ready!";
            el.previousElementSibling.disabled = false;
        }
    });
}, 1000);

init();
