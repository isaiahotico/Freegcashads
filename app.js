
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

let uData = {};
let userCursor = null, ownerCursor = null;

function init() {
    document.getElementById('uName').innerText = "👤 " + rawUser;
    document.getElementById('myId').innerText = rawUser;

    // Real-time User Data
    db.collection('users').doc(userDocId).onSnapshot(doc => {
        if(doc.exists) {
            uData = doc.data();
            document.getElementById('uBal').innerText = "₱" + (uData.balance || 0).toFixed(3);
            document.getElementById('refCount').innerText = uData.refCount || 0;
            document.getElementById('refBonus').innerText = "₱" + (uData.referralBonus || 0).toFixed(3);
        } else {
            db.collection('users').doc(userDocId).set({ balance: 0, totalEarned: 0, referralBonus: 0, refCount: 0, cooldowns: {} });
        }
    });

    renderTaskButtons();
    loadChat();
    loadLeaders();
    fetchWithdrawals('user');
}

// --- CORE REWARD ENGINE (Fixes Balance 0 Issue) ---
async function handleReward(amount) {
    const userRef = db.collection('users').doc(userDocId);
    
    // 1. Credit User
    await userRef.update({
        balance: firebase.firestore.FieldValue.increment(amount),
        totalEarned: firebase.firestore.FieldValue.increment(amount)
    });

    // 2. 10% Passive Referral Bonus (Top Concept)
    if(uData.referredBy) {
        const bonus = amount * 0.10;
        db.collection('users').doc(uData.referredBy).update({
            referralBonus: firebase.firestore.FieldValue.increment(bonus)
        });
    }
}

async function runSequence(type, id, zone, rew, cd, isPop) {
    const key = `${type}_${id}`;
    if(uData.cooldowns?.[key] > Date.now()) return alert("Wait for cooldown!");

    try {
        const ad = isPop ? () => window['show_'+zone]('pop') : () => window['show_'+zone]();
        // 3 combined ads inline
        await ad(); await ad(); await ad();
        
        await handleReward(rew);
        await db.collection('users').doc(userDocId).update({
            [`cooldowns.${key}`]: Date.now() + (cd * 1000)
        });
        alert("🎉 Reward Added!");
    } catch(e) { alert("Ad failed to load."); }
}

// --- CHAT WITH ADS ---
async function sendChatMessage() {
    const txt = document.getElementById('chatInput').value;
    if(!txt) return;
    
    try {
        // 3 Monetag + 1 Adsgram Style Sequence
        await window.show_10276123(); 
        await window.show_10337795(); 
        await window.show_10337853();
        await window.show_10276123('pop');

        await db.collection('messages').add({ user: rawUser, text: txt, time: Date.now() });
        await handleReward(0.02);
        document.getElementById('chatInput').value = "";
    } catch(e) { alert("Complete ads to send!"); }
}

// --- WITHDRAWALS (Real-time & Paginated) ---
async function requestWithdrawal() {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const addr = document.getElementById('wAddr').value;
    const method = document.getElementById('wMethod').value;
    
    if(amt > uData.balance || amt < 1) return alert("Insufficient Balance");

    await db.collection('withdrawals').add({
        user: rawUser, amount: amt, info: addr, method: method,
        status: 'pending', time: Date.now()
    });
    await db.collection('users').doc(userDocId).update({ balance: firebase.firestore.FieldValue.increment(-amt) });
    alert("Withdrawal Requested!");
}

function fetchWithdrawals(target, direction = 'next') {
    let query = db.collection('withdrawals');
    
    if(target === 'user') {
        query = query.where('user', '==', rawUser).orderBy('time', 'desc');
    } else {
        // Owner logic: Pending first, then time
        query = query.orderBy('status', 'desc').orderBy('time', 'desc');
    }

    query.limit(15).onSnapshot(snap => {
        if(snap.empty) return;
        const docs = snap.docs;
        const html = docs.map(d => {
            const w = d.data();
            const btn = target === 'owner' && w.status === 'pending' ? 
                `<button onclick="updateW('${d.id}','approved')">✔</button><button onclick="updateW('${d.id}','denied')">❌</button>` : '';
            return `<tr><td>${w.user}</td><td>${w.method}: ${w.info}</td><td>₱${w.amount}</td><td>${new Date(w.time).toLocaleDateString()}</td><td class="status-${w.status}">${w.status} ${btn}</td></tr>`;
        }).join('');

        const table = `<table><tr><th>Name</th><th>Account</th><th>Amt</th><th>Date</th><th>Status</th></tr>${html}</table>`;
        document.getElementById(target === 'user' ? 'userWithdrawTable' : 'ownerWithdrawTable').innerHTML = table;
    });
}

async function updateW(id, status) { await db.collection('withdrawals').doc(id).update({ status }); }

// --- REFERRAL SYSTEM ---
async function setReferrer() {
    const ref = document.getElementById('refInput').value.trim();
    if(ref === rawUser || uData.referredBy) return alert("Invalid Operation");
    
    const refDoc = await db.collection('users').doc(ref).get();
    if(refDoc.exists) {
        await db.collection('users').doc(userDocId).update({ referredBy: ref });
        await db.collection('users').doc(ref).update({ refCount: firebase.firestore.FieldValue.increment(1) });
        alert("Referrer Linked!");
    } else alert("User not found");
}

async function claimReferralBonus() {
    if(uData.referralBonus < 0.01) return alert("Nothing to claim");
    const bonus = uData.referralBonus;
    await db.collection('users').doc(userDocId).update({
        balance: firebase.firestore.FieldValue.increment(bonus),
        referralBonus: 0
    });
    alert("Bonus claimed!");
}

// --- UI HELPERS ---
function showPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(p).classList.add('active');
}

function renderTaskButtons() {
    const sets = [
        { div: 'list-ads', type: 'ads', count: 3, rew: 0.02, cd: 300, ids: [10276123, 10337795, 10337853] },
        { div: 'list-signin', type: 'signin', count: 3, rew: 0.025, cd: 3600, ids: [10276123, 10337795, 10337853] },
        { div: 'list-gift', type: 'gift', count: 3, rew: 0.02, cd: 10800, ids: [10276123, 10337795, 10337853], pop: true }
    ];
    sets.forEach(s => {
        let h = '';
        for(let i=1; i<=s.count; i++) {
            h += `<div class="card"><b>${s.type.toUpperCase()} #${i}</b><br>
            <button class="btn" id="btn-${s.type}-${i}" onclick="runSequence('${s.type}', ${i}, ${s.ids[i-1]}, ${s.rew}, ${s.cd}, ${s.pop||false})">Watch & Earn ₱${s.rew}</button>
            <div id="tm-${s.type}-${i}" style="font-size:10px; color:red;">Ready</div></div>`;
        }
        document.getElementById(s.div).innerHTML = h;
    });
}

function checkAdmin() {
    if(prompt("Code:") === "Propetas6") {
        showPage('p-admin');
        fetchWithdrawals('owner');
    }
}

function loadChat() {
    db.collection('messages').orderBy('time', 'desc').limit(20).onSnapshot(snap => {
        document.getElementById('chat-box').innerHTML = snap.docs.map(d => `<div class="msg"><b>${d.data().user}:</b> ${d.data().text}</div>`).join('');
    });
}

function loadLeaders() {
    db.collection('users').orderBy('totalEarned', 'desc').limit(10).onSnapshot(snap => {
        document.querySelector('#leadTable tbody').innerHTML = snap.docs.map(d => `<tr><td>${d.id}</td><td>₱${(d.data().totalEarned||0).toFixed(2)}</td></tr>`).join('');
    });
}

setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('[id^="tm-"]').forEach(el => {
        const key = el.id.replace('tm-', '').replace('-', '_');
        const target = uData.cooldowns?.[key] || 0;
        if(target > now) {
            el.innerText = `Wait: ${Math.ceil((target-now)/1000)}s`;
            el.previousElementSibling.disabled = true;
        } else {
            el.innerText = "Ready!";
            el.previousElementSibling.disabled = false;
        }
    });
}, 1000);

init();
