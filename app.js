
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
const uid = tg?.initDataUnsafe?.user?.id?.toString() || "dev_user";
const uname = tg?.initDataUnsafe?.user?.username || "User_" + uid.slice(0,4);

let uData = { balance: 0, cooldowns: {}, totalEarned: 0 };

// --- Initialization ---
function init() {
    document.getElementById('uName').innerText = "👤 " + uname;
    
    // Live User Data Listener
    db.collection('users').doc(uid).onSnapshot(doc => {
        if(doc.exists) {
            uData = doc.data();
            document.getElementById('uBal').innerText = "₱" + (uData.balance || 0).toFixed(3);
            document.getElementById('refCount').innerText = uData.refCount || 0;
        } else {
            db.collection('users').doc(uid).set({ username: uname, balance: 0, totalEarned: 0, cooldowns: {} });
        }
    });

    renderAllTasks();
    loadHistory();
    loadChat();
    loadLeaders();
    syncStats();
    
    // Auto Show Ad on page open
    setTimeout(() => triggerInApp(10276123), 5000);
}

// --- Task Rendering ---
function renderAllTasks() {
    const sections = [
        { id: 'ads-list', type: 'ads', count: 3, rew: 0.02, cd: 300, ids: [10276123, 10337795, 10337853] },
        { id: 'signin-list', type: 'signin', count: 3, rew: 0.025, cd: 10800, ids: [10276123, 10337795, 10337853] },
        { id: 'gift-list', type: 'gift', count: 3, rew: 0.02, cd: 10800, ids: [10276123, 10337795, 10337853], pop: true },
        { id: 'quick-list', type: 'quick', count: 5, rew: 0.01, cd: 60, ids: [10276123, 10337795, 10337853] }
    ];

    sections.forEach(s => {
        let html = '';
        for(let i=1; i<=s.count; i++) {
            const tag = s.ids[i-1] || s.ids[0];
            html += `<div class="card">
                <b>Task #${i}</b><br>
                <button class="btn" id="btn-${s.type}-${i}" onclick="runAd('${s.type}', ${i}, ${tag}, ${s.rew}, ${s.cd}, ${s.pop || false})">Watch Ad</button>
                <div class="timer" id="tm-${s.type}-${i}">Ready</div>
            </div>`;
        }
        document.getElementById(s.id).innerHTML = html;
    });
}

// --- Ads Logic ---
async function runAd(type, id, tag, rew, cd, isPop) {
    const key = `${type}_${id}`;
    if(uData.cooldowns[key] > Date.now()) return alert("In cooldown!");

    try {
        const fn = "show_" + tag;
        if(isPop) await window[fn]('pop');
        else await window[fn]();

        // On Success
        const now = Date.now();
        const updates = {
            balance: firebase.firestore.FieldValue.increment(rew),
            totalEarned: firebase.firestore.FieldValue.increment(rew)
        };
        updates[`cooldowns.${key}`] = now + (cd * 1000);
        
        await db.collection('users').doc(uid).update(updates);
        alert("🎉Congratulations🎉 you earned money!! 😍🍍");
    } catch(e) { alert("Ad failed."); }
}

function triggerInApp(tag) {
    window["show_" + tag]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
}

// --- Chat Logic ---
function loadChat() {
    const today = new Date().toDateString();
    db.collection('chats').orderBy('timestamp', 'desc').limit(100).onSnapshot(snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = snap.docs
            .filter(d => new Date(d.data().timestamp).toDateString() === today)
            .map(d => `<div class="msg"><b>${d.data().user}:</b> ${d.data().msg}</div>`).join('');
    });
}

async function sendChatMessage() {
    const msg = document.getElementById('chatInput').value;
    if(!msg || (Date.now() - (uData.lastChat || 0) < 240000)) return alert("Cooldown 4m");

    await window.show_10276123(); // Chat Ad
    await db.collection('chats').add({ user: uname, msg, timestamp: Date.now(), userId: uid });
    await db.collection('users').doc(uid).update({ 
        balance: firebase.firestore.FieldValue.increment(0.02),
        lastChat: Date.now() 
    });
    document.getElementById('chatInput').value = "";
}

// --- Finance & Admin ---
function updateWithdrawUI() {
    const amt = document.getElementById('wAmt').value || 0;
    const method = document.getElementById('wMethod').value;
    if(method === 'faucetpay') document.getElementById('convertText').innerText = `≈ ${(amt * 0.017).toFixed(4)} USDT`;
    else document.getElementById('convertText').innerText = "";
}

async function requestWithdraw() {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const addr = document.getElementById('wAddr').value;
    if(amt > uData.balance || amt < 1) return alert("Invalid amount");

    await db.collection('withdrawals').add({ uid, uname, amt, addr, method: document.getElementById('wMethod').value, status: 'pending', time: Date.now() });
    await db.collection('users').doc(uid).update({ balance: firebase.firestore.FieldValue.increment(-amt) });
    alert("Request Sent!");
}

function checkAdmin() {
    if(prompt("Password:") === "Propetas6") {
        showPage('p-admin');
        db.collection('withdrawals').orderBy('status', 'desc').onSnapshot(snap => {
            document.getElementById('admin-reqs').innerHTML = snap.docs.map(doc => {
                const d = doc.data();
                return `<div class="card" style="font-size:11px">${d.uname} - ₱${d.amt} (${d.status})
                <br><button onclick="adminSet('${doc.id}', 'approved', ${d.amt})">Approve</button>
                <button onclick="adminSet('${doc.id}', 'denied', 0)">Deny</button></div>`;
            }).join('');
        });
    }
}

async function adminSet(id, stat, amt) {
    await db.collection('withdrawals').doc(id).update({ status: stat });
    if(stat === 'approved') db.collection('globals').doc('stats').update({ totalPaid: firebase.firestore.FieldValue.increment(amt) });
}

// --- Helpers ---
function showPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(p).classList.add('active');
}

function loadLeaders() {
    db.collection('users').orderBy('totalEarned', 'desc').limit(10).onSnapshot(snap => {
        document.querySelector('#leadTable tbody').innerHTML = snap.docs.map(d => `<tr><td>${d.data().username}</td><td>₱${d.data().totalEarned.toFixed(2)}</td></tr>`).join('');
    });
}

function syncStats() {
    db.collection('globals').doc('stats').onSnapshot(doc => {
        if(doc.exists) document.getElementById('totalPaid').innerText = "₱" + doc.data().totalPaid.toFixed(2);
    });
}

setInterval(() => {
    // UI Cooldown Updates
    const now = Date.now();
    document.querySelectorAll('.timer').forEach(el => {
        const id = el.id.replace('tm-', '').replace('-', '_');
        const target = uData.cooldowns?.[id] || 0;
        if(target > now) {
            const diff = target - now;
            const m = Math.floor(diff/60000);
            const s = Math.floor((diff%60000)/1000);
            el.innerText = `Wait ${m}m ${s}s`;
            el.previousElementSibling.disabled = true;
        } else {
            el.innerText = "Ready!";
            el.previousElementSibling.disabled = false;
        }
    });
}, 1000);

init();
