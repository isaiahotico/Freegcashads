
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

// IMPORTANT: Using Username as ID to match your security rules
const tg = window.Telegram?.WebApp;
const rawUsername = tg?.initDataUnsafe?.user?.username || tg?.initDataUnsafe?.user?.first_name || "Guest";
const userDocId = rawUsername.replace(/\s+/g, '_'); // Clean username for ID

let userData = { balance: 0, cooldowns: {}, totalEarned: 0 };

function init() {
    document.getElementById('uName').innerText = "👤 " + userDocId;
    
    // Live Balance Sync
    db.collection('users').doc(userDocId).onSnapshot(doc => {
        if(doc.exists) {
            userData = doc.data();
            document.getElementById('uBal').innerText = "₱" + (userData.balance || 0).toFixed(3);
        } else {
            db.collection('users').doc(userDocId).set({ balance: 0, totalEarned: 0, cooldowns: {} });
        }
    });

    renderTasks();
    loadChat();
    loadLeaderboard();
}

function renderTasks() {
    const tasks = [
        { div: 'list-ads', type: 'ads', count: 3, rew: 0.02, cd: 300, ids: [10276123, 10337795, 10337853] },
        { div: 'list-signin', type: 'signin', count: 3, rew: 0.025, cd: 10800, ids: [10276123, 10337795, 10337853] },
        { div: 'list-gift', type: 'gift', count: 3, rew: 0.02, cd: 10800, ids: [10276123, 10337795, 10337853], pop: true },
        { div: 'list-quick', type: 'quick', count: 5, rew: 0.01, cd: 60, ids: [10276123, 10337795, 10337853] }
    ];

    tasks.forEach(t => {
        let h = '';
        for(let i=1; i<=t.count; i++) {
            h += `<div class="card"><b>${t.type.toUpperCase()} #${i}</b><br>
            <button class="btn" id="btn-${t.type}-${i}" onclick="claimAd('${t.type}', ${i}, ${t.ids[i-1]}, ${t.rew}, ${t.cd}, ${t.pop || false})">Watch & Earn</button>
            <div class="timer" id="tm-${t.type}-${i}">Ready</div></div>`;
        }
        document.getElementById(t.div).innerHTML = h;
    });
}

async function claimAd(type, id, zone, rew, cd, isPop) {
    const key = `${type}_${id}`;
    if(userData.cooldowns?.[key] > Date.now()) return alert("Cooldown active!");

    try {
        const fn = "show_" + zone;
        if(isPop) await window[fn]('pop'); else await window[fn]();

        // SUCCESS REWARD LOGIC - Explicit update to fix balance
        const newBal = (userData.balance || 0) + rew;
        const newTotal = (userData.totalEarned || 0) + rew;
        const newCDs = {...userData.cooldowns};
        newCDs[key] = Date.now() + (cd * 1000);

        await db.collection('users').doc(userDocId).update({
            balance: newBal,
            totalEarned: newTotal,
            cooldowns: newCDs
        });

        alert("🎉 Reward Added: ₱" + rew);
    } catch(e) { alert("Ad Failed to complete."); }
}

// --- Chat Section ---
function loadChat() {
    db.collection('messages').orderBy('time', 'desc').limit(50).onSnapshot(snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = snap.docs.map(d => `<div class="msg"><b>${d.data().user}:</b> ${d.data().text}</div>`).join('');
    });
}

async function sendChat() {
    const txt = document.getElementById('chatInput').value;
    if(!txt) return;
    await window.show_10276123(); // Message Ad
    await db.collection('messages').add({ user: userDocId, text: txt, time: Date.now() });
    await db.collection('users').doc(userDocId).update({ balance: (userData.balance || 0) + 0.02 });
    document.getElementById('chatInput').value = "";
}

// --- Withdraw ---
function calcConvert() {
    const a = document.getElementById('wAmt').value;
    const m = document.getElementById('wMethod').value;
    document.getElementById('convertText').innerText = m === 'faucetpay' ? `≈ ${(a*0.017).toFixed(4)} USDT` : "";
}

async function submitWithdraw() {
    const amt = parseFloat(document.getElementById('wAmt').value);
    if(amt > userData.balance) return alert("Low balance");
    await db.collection('withdrawals').add({ user: userDocId, amt, status: 'pending', time: Date.now() });
    await db.collection('users').doc(userDocId).update({ balance: userData.balance - amt });
    alert("Submitted!");
}

// --- Admin ---
function checkAdmin() {
    if(prompt("Pass:") === "Propetas6") {
        showPage('p-admin');
        db.collection('withdrawals').where('status', '==', 'pending').onSnapshot(snap => {
            document.getElementById('admin-reqs').innerHTML = snap.docs.map(doc => `
                <div class='card'>${doc.data().user}: ₱${doc.data().amt}
                <button onclick="setStatus('${doc.id}', 'approved')">✔</button></div>
            `).join('');
        });
    }
}

async function setStatus(id, s) { await db.collection('withdrawals').doc(id).update({ status: s }); }

function showPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(p).classList.add('active');
}

function loadLeaderboard() {
    db.collection('users').orderBy('totalEarned', 'desc').limit(10).onSnapshot(snap => {
        document.querySelector('#leadTable tbody').innerHTML = snap.docs.map(d => `<tr><td>${d.id}</td><td>₱${d.data().totalEarned.toFixed(2)}</td></tr>`).join('');
    });
}

setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('.timer').forEach(el => {
        const id = el.id.replace('tm-', '').replace('-', '_');
        const target = userData.cooldowns?.[id] || 0;
        if(target > now) {
            el.innerText = "Wait: " + Math.ceil((target-now)/1000) + "s";
            el.previousElementSibling.disabled = true;
        } else {
            el.innerText = "Ready!";
            el.previousElementSibling.disabled = false;
        }
    });
}, 1000);

init();
