
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

// Identity Logic (Uses Username for the Doc ID to match security rules)
const tg = window.Telegram?.WebApp;
const rawUser = tg?.initDataUnsafe?.user?.username || tg?.initDataUnsafe?.user?.first_name || "Guest_User";
const userDocId = rawUser.replace(/\s+/g, '_');

let uData = { balance: 0, totalEarned: 0, cooldowns: {} };

// --- Initialize App ---
function init() {
    document.getElementById('uName').innerText = "👤 " + userDocId;
    document.getElementById('myUsername').innerText = userDocId;

    // Real-time Sync
    db.collection('users').doc(userDocId).onSnapshot(doc => {
        if(doc.exists) {
            uData = doc.data();
            document.getElementById('uBal').innerText = "₱" + (uData.balance || 0).toFixed(3);
        } else {
            db.collection('users').doc(userDocId).set({ balance: 0, totalEarned: 0, cooldowns: {}, lastChat: 0 });
        }
    });

    renderTasks();
    loadChat();
    loadLeaders();
    loadHistory();
    
    // Auto-Interstitials every 3 minutes
    setInterval(() => triggerInApp(10276123), 180000);
}

// --- Dynamic Task Rendering ---
function renderTasks() {
    const categories = [
        { div: 'list-ads', type: 'ads', count: 3, rew: 0.02, cd: 300, ids: [10276123, 10337795, 10337853] },
        { div: 'list-signin', type: 'signin', count: 3, rew: 0.025, cd: 10800, ids: [10276123, 10337795, 10337853] },
        { div: 'list-gift', type: 'gift', count: 3, rew: 0.02, cd: 10800, ids: [10276123, 10337795, 10337853], pop: true },
        { div: 'list-quick', type: 'quick', count: 5, rew: 0.01, cd: 60, ids: [10276123, 10337795, 10337853] }
    ];

    categories.forEach(cat => {
        let html = '';
        for(let i=1; i<=cat.count; i++){
            html += `<div class="card">
                <strong>${cat.type.toUpperCase()} Task #${i}</strong><br>
                <button class="btn" id="btn-${cat.type}-${i}" onclick="handleAd('${cat.type}', ${i}, ${cat.ids[i-1]}, ${cat.rew}, ${cat.cd}, ${cat.pop||false})">Watch & Claim</button>
                <div id="tm-${cat.type}-${i}" style="font-size:10px; margin-top:5px;">Ready</div>
            </div>`;
        }
        document.getElementById(cat.div).innerHTML = html;
    });
}

// --- Core Reward Logic ---
async function handleAd(type, id, zone, rew, cd, isPop) {
    const key = `${type}_${id}`;
    if(uData.cooldowns?.[key] > Date.now()) return alert("In cooldown!");

    try {
        const fn = "show_" + zone;
        if(isPop) await window[fn]('pop'); else await window[fn]();

        // UPDATE FIRESTORE (Fixing no credit issue)
        const newCDs = {...(uData.cooldowns || {})};
        newCDs[key] = Date.now() + (cd * 1000);

        await db.collection('users').doc(userDocId).update({
            balance: firebase.firestore.FieldValue.increment(rew),
            totalEarned: firebase.firestore.FieldValue.increment(rew),
            cooldowns: newCDs
        });

        triggerAnim(rew);
    } catch(e) { alert("Ad interrupted or failed."); }
}

function triggerAnim(amt) {
    const el = document.getElementById('reward-notif');
    const msgs = ["💰 Awesome!", "🍍 Delicious!", "🔥 Hot Reward!", "🚀 To the Moon!", "💎 Pure Gold!"];
    el.innerHTML = `<h2>${msgs[Math.floor(Math.random()*msgs.length)]}</h2><p>You earned ₱${amt}</p>`;
    el.className = "reward-pop anim-bounce";
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

// --- Chat Logic ---
function loadChat() {
    const today = new Date().toDateString();
    db.collection('messages').orderBy('time', 'desc').limit(50).onSnapshot(snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = snap.docs
            .filter(d => new Date(d.data().time).toDateString() === today)
            .map(d => `<div class="msg"><b>${d.data().user}:</b> ${d.data().text}</div>`).join('');
    });
}

async function sendChat() {
    const txt = document.getElementById('chatInput').value;
    if(!txt) return;
    if(Date.now() - (uData.lastChat || 0) < 240000) return alert("Chat Cooldown: 4 mins");

    await window.show_10276123(); // Monetag requirement
    await db.collection('messages').add({ user: userDocId, text: txt, time: Date.now() });
    await db.collection('users').doc(userDocId).update({ 
        balance: firebase.firestore.FieldValue.increment(0.02),
        lastChat: Date.now() 
    });
    document.getElementById('chatInput').value = "";
}

// --- Finance ---
function updateWUI() {
    const amt = document.getElementById('wAmt').value || 0;
    const method = document.getElementById('wMethod').value;
    if(method === 'faucetpay') document.getElementById('convertText').innerText = `≈ ${(amt * 0.0175).toFixed(4)} USDT`;
    else document.getElementById('convertText').innerText = "";
}

async function submitWithdraw() {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const addr = document.getElementById('wAddr').value;
    if(amt > uData.balance || amt < 1) return alert("Minimum 1 PHP / Insufficient Funds");

    await db.collection('withdrawals').add({ 
        user: userDocId, amt, addr, status: 'pending', time: Date.now(), 
        method: document.getElementById('wMethod').value 
    });
    await db.collection('users').doc(userDocId).update({ balance: firebase.firestore.FieldValue.increment(-amt) });
    alert("Withdrawal Requested!");
}

function loadHistory() {
    db.collection('withdrawals').where('user', '==', userDocId).orderBy('time', 'desc').limit(5).onSnapshot(snap => {
        let h = '<h4>Withdrawal History</h4><table>';
        snap.forEach(d => { h += `<tr><td>₱${d.data().amt}</td><td>${d.data().status}</td></tr>`; });
        document.getElementById('wHistory').innerHTML = h + '</table>';
    });
}

// --- Owner Dashboard ---
function checkAdmin() {
    if(prompt("Owner Access Code:") === "Propetas6") {
        showPage('p-admin');
        db.collection('withdrawals').orderBy('status', 'desc').onSnapshot(snap => {
            document.getElementById('admin-reqs').innerHTML = snap.docs.map(doc => `
                <div class="card" style="font-size:11px; text-align:left;">
                    ${doc.data().user} | ₱${doc.data().amt} | ${doc.data().method}<br>
                    <small>${doc.data().addr}</small><br>
                    <button onclick="approveW('${doc.id}')">Approve</button>
                    <button onclick="denyW('${doc.id}')">Deny</button>
                </div>
            `).join('');
        });
    }
}

async function approveW(id) { await db.collection('withdrawals').doc(id).update({ status: 'approved' }); }
async function denyW(id) { await db.collection('withdrawals').doc(id).update({ status: 'denied' }); }

// --- Helpers ---
function showPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(p).classList.add('active');
}

function loadLeaders() {
    db.collection('users').orderBy('totalEarned', 'desc').limit(10).onSnapshot(snap => {
        document.querySelector('#leadTable tbody').innerHTML = snap.docs.map(d => `<tr><td>${d.id}</td><td>₱${d.data().totalEarned.toFixed(2)}</td></tr>`).join('');
    });
}

function triggerInApp(zone) {
    if(typeof window['show_'+zone] === 'function') window['show_'+zone]({ type:'inApp', inAppSettings:{ frequency:2, capping:0.1, interval:30, timeout:5, everyPage:false }});
}

// Timer Loop
setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('[id^="tm-"]').forEach(el => {
        const key = el.id.replace('tm-', '').replace('-', '_');
        const target = uData.cooldowns?.[key] || 0;
        if(target > now) {
            const sec = Math.ceil((target - now)/1000);
            el.innerText = `Wait ${sec}s`;
            el.previousElementSibling.disabled = true;
        } else {
            el.innerText = "Ready!";
            el.previousElementSibling.disabled = false;
        }
    });
}, 1000);

init();
