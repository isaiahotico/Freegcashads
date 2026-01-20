
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

const adsgramIds = ['21423', '21470', 'int-21471', 'int-21422', 'task-21424', 'task-21469'];
let uData = { balance: 0, cooldowns: {} };
let uPg = 1, oPg = 1;

function init() {
    document.getElementById('uName').innerText = "👤 " + rawUser;
    document.getElementById('myId').innerText = rawUser;

    // Real-time Balance Listener
    db.collection('users').doc(userDocId).onSnapshot(doc => {
        if (doc.exists) {
            uData = doc.data();
            document.getElementById('uBal').innerText = "₱" + (uData.balance || 0).toFixed(3);
            document.getElementById('refCount').innerText = uData.refCount || 0;
        } else {
            db.collection('users').doc(userDocId).set({ balance: 0, totalEarned: 0, refCount: 0, cooldowns: {} });
        }
    });

    renderAllButtons();
    loadChat();
    loadLeaders();
    fetchHistory('user');
}

// --- MASTER AD SEQUENCE (3 Monetag + 1 Adsgram) ---
async function runAdSequence(type, id, rew, cd) {
    const key = `${type}_${id}`;
    if (uData.cooldowns?.[key] > Date.now()) return alert("Cooldown Active!");

    const btn = document.getElementById(`btn-${type}-${id}`);
    const originalText = btn.innerText;

    try {
        btn.disabled = true;
        // Monetag 1, 2, 3
        const zones = ['10276123', '10337795', '10337853'];
        for (let i = 0; i < 3; i++) {
            btn.innerText = `Ads Loading ${i + 1}/4...`;
            await window['show_' + zones[i]]();
        }

        // Adsgram 4
        btn.innerText = `Final Adsgram Ad...`;
        const randGram = adsgramIds[Math.floor(Math.random() * adsgramIds.length)];
        await window.Adsgram.init({ blockId: randGram }).show();

        // CREDIT REWARD
        await db.collection('users').doc(userDocId).update({
            balance: firebase.firestore.FieldValue.increment(rew),
            totalEarned: firebase.firestore.FieldValue.increment(rew),
            [`cooldowns.${key}`]: Date.now() + (cd * 1000)
        });

        alert("🎉 Congratulations! Reward added to balance.");
        btn.innerText = originalText;
    } catch (e) {
        alert("Ads interrupted. Try again.");
        btn.innerText = originalText;
    } finally {
        btn.disabled = false;
    }
}

// --- WITHDRAWAL & PAGINATION (15 per page) ---
async function submitWithdraw() {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const addr = document.getElementById('wAddr').value;
    const method = document.getElementById('wMethod').value;
    if (amt > uData.balance || amt < 1) return alert("Insufficient Balance (Min 1 PHP)");

    await db.collection('withdrawals').add({
        user: rawUser, addr, amt, method, status: 'pending', s_rank: 0, time: Date.now()
    });
    await db.collection('users').doc(userDocId).update({ balance: firebase.firestore.FieldValue.increment(-amt) });
    alert("Withdrawal Synced!");
}

function fetchHistory(view) {
    let q = db.collection('withdrawals');
    if (view === 'user') q = q.where('user', '==', rawUser).orderBy('time', 'desc');
    else q = q.orderBy('s_rank', 'asc').orderBy('time', 'desc');

    const pg = view === 'user' ? uPg : oPg;
    q.limit(pg * 15).onSnapshot(snap => {
        const docs = snap.docs.slice((pg - 1) * 15, pg * 15);
        let h = `<table><tr><th>User</th><th>Info</th><th>Amt</th><th>Date</th><th>Status</th>${view === 'owner' ? '<th>Action</th>' : ''}</tr>`;
        docs.forEach(doc => {
            const w = doc.data();
            const date = new Date(w.time).toLocaleDateString();
            h += `<tr><td>${w.user}</td><td>${w.method}: ${w.addr}</td><td>₱${w.amt}</td><td>${date}</td><td class="status-${w.status}">${w.status}</td>
            ${view === 'owner' && w.status === 'pending' ? `<td><button onclick="approveW('${doc.id}','approved')">✔</button><button onclick="approveW('${doc.id}','denied')">❌</button></td>` : view === 'owner' ? '<td>-</td>' : ''}</tr>`;
        });
        document.getElementById(view === 'user' ? 'userWTable' : 'ownerWTable').innerHTML = h + '</table>';
    });
}

function pg(v, d) {
    if (v === 'user') uPg = Math.max(1, uPg + d);
    else oPg = Math.max(1, oPg + d);
    fetchHistory(v);
}

async function approveW(id, s) { await db.collection('withdrawals').doc(id).update({ status: s, s_rank: 1 }); }

// --- CHAT SYSTEM ---
async function sendChat() {
    const txt = document.getElementById('chatInput').value;
    if (!txt) return;
    try {
        const zones = ['10276123', '10337795', '10337853'];
        for (let z of zones) await window['show_' + z]();
        await window.Adsgram.init({ blockId: '21423' }).show();

        await db.collection('messages').add({ user: rawUser, text: txt, time: Date.now() });
        await db.collection('users').doc(userDocId).update({ balance: firebase.firestore.FieldValue.increment(0.02) });
        document.getElementById('chatInput').value = "";
    } catch (e) { alert("Complete ads to send!"); }
}

function loadChat() {
    db.collection('messages').orderBy('time', 'desc').limit(20).onSnapshot(snap => {
        document.getElementById('chat-box').innerHTML = snap.docs.map(d => `<div class="msg"><b>${d.data().user}:</b> ${d.data().text}</div>`).join('');
    });
}

// --- UTILS ---
function renderAllButtons() {
    const config = [
        { id: 'list-ads', type: 'ads', count: 3, rew: 0.02, cd: 300 },
        { id: 'list-gift', type: 'gift', count: 3, rew: 0.02, cd: 10800 },
        { id: 'list-signin', type: 'signin', count: 3, rew: 0.025, cd: 3600 }
    ];
    config.forEach(c => {
        let html = `<h3>${c.type.toUpperCase()} AREA</h3>`;
        for (let i = 1; i <= c.count; i++) {
            html += `<div class="card"><b>🍍 Task #${i} 🍍</b><br>
            <button class="btn" id="btn-${c.type}-${i}" onclick="runAdSequence('${c.type}', ${i}, ${c.rew}, ${c.cd})">Watch 4 Ads & Earn</button>
            <div id="tm-${c.type}-${i}" style="font-size:10px; color:red; margin-top:5px;">Ready</div></div>`;
        }
        document.getElementById(c.id).innerHTML = html;
    });
}

async function saveReferrer() {
    const ref = document.getElementById('refInput').value.trim();
    if (!ref || ref === rawUser || uData.refBy) return alert("Invalid or already set!");
    const rDoc = await db.collection('users').doc(ref).get();
    if (rDoc.exists) {
        await db.collection('users').doc(userDocId).update({ refBy: ref });
        await db.collection('users').doc(ref).update({ refCount: firebase.firestore.FieldValue.increment(1) });
        alert("Referrer Linked!");
    }
}

function loadLeaders() {
    db.collection('users').orderBy('totalEarned', 'desc').limit(10).onSnapshot(snap => {
        document.querySelector('#leadTable tbody').innerHTML = snap.docs.map(d => `<tr><td>${d.id}</td><td>₱${(d.data().totalEarned || 0).toFixed(2)}</td></tr>`).join('');
    });
}

function checkAdmin() { if (prompt("Password:") === "Propetas6") { showPage('p-admin'); fetchHistory('owner'); } }

function showPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(p).classList.add('active');
}

setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('[id^="tm-"]').forEach(el => {
        const key = el.id.replace('tm-', '').replace('-', '_');
        const target = uData.cooldowns?.[key] || 0;
        if (target > now) {
            el.innerText = "Wait: " + Math.ceil((target - now) / 1000) + "s";
            el.previousElementSibling.disabled = true;
        } else {
            el.innerText = "Ready!";
            el.previousElementSibling.disabled = false;
        }
    });
}, 1000);

init();
