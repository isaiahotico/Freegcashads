
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

// --- Telegram & Identity ---
const tg = window.Telegram?.WebApp;
tg?.ready();
const rawUser = tg?.initDataUnsafe?.user?.username || tg?.initDataUnsafe?.user?.first_name || "Guest";
const userDocId = rawUser.replace(/\s+/g, '_');

let uData = { balance: 0, cooldowns: {} };

// --- Init App ---
function init() {
    document.getElementById('uName').innerText = "👤 " + rawUser;
    
    // Auto Show Ads (Cooldown 3 mins)
    setInterval(() => {
        const zone = [10276123, 10337795, 10337853][Math.floor(Math.random()*3)];
        window['show_'+zone]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }});
    }, 180000);

    // Sync Data
    db.collection('users').doc(userDocId).onSnapshot(doc => {
        if(doc.exists) {
            uData = doc.data();
            document.getElementById('uBal').innerText = "₱" + (uData.balance || 0).toFixed(3);
        } else {
            db.collection('users').doc(userDocId).set({ balance: 0, totalEarned: 0, cooldowns: {} });
        }
    });

    renderAllTasks();
    loadChat();
    loadLeaders();
    syncWithdrawals();
}

// --- Task Engine (3 Ads Inline) ---
function renderAllTasks() {
    const categories = [
        { div: 'list-ads', type: 'ads', count: 3, rew: 0.02, cd: 300, ids: [10276123, 10337795, 10337853] },
        { div: 'list-gift', type: 'gift', count: 3, rew: 0.02, cd: 10800, ids: [10276123, 10337795, 10337853], pop: true },
        { div: 'list-signin', type: 'signin', count: 3, rew: 0.025, cd: 3600, ids: [10276123, 10337795, 10337853] }
    ];

    categories.forEach(cat => {
        let h = `<h3>${cat.type.toUpperCase()} AREA</h3>`;
        for(let i=1; i<=cat.count; i++) {
            h += `<div class="card">
                <b>${cat.type.toUpperCase()} #${i}</b><br>
                <button class="btn" id="btn-${cat.type}-${i}" onclick="startSequence('${cat.type}', ${i}, ${cat.ids[i-1]}, ${cat.rew}, ${cat.cd}, ${cat.pop||false})">Watch 3 Ads Combined</button>
                <div id="tm-${cat.type}-${i}" style="font-size:10px; margin-top:5px; color:#e74c3c;">Ready</div>
            </div>`;
        }
        document.getElementById(cat.div).innerHTML = h;
    });
}

async function startSequence(type, id, zone, rew, cd, isPop) {
    const key = `${type}_${id}`;
    if(uData.cooldowns?.[key] > Date.now()) return alert("Cooldown active!");
    
    const btn = document.getElementById(`btn-${type}-${id}`);
    const originalText = btn.innerText;

    try {
        const adFunc = isPop ? () => window['show_'+zone]('pop') : () => window['show_'+zone]();
        
        btn.innerText = "Ad 1/3...";
        await adFunc();
        btn.innerText = "Ad 2/3...";
        await adFunc();
        btn.innerText = "Ad 3/3...";
        await adFunc();

        // Finalize Reward
        const updateObj = {
            balance: firebase.firestore.FieldValue.increment(rew),
            totalEarned: firebase.firestore.FieldValue.increment(rew),
            [`cooldowns.${key}`]: Date.now() + (cd * 1000)
        };
        await db.collection('users').doc(userDocId).update(updateObj);
        
        showRewardPop(rew);
        btn.innerText = originalText;
    } catch(e) {
        alert("Sequence interrupted.");
        btn.innerText = originalText;
    }
}

function showRewardPop(amt) {
    const el = document.getElementById('reward-notif');
    el.innerHTML = `<h2>🎉CONGRATULATIONS!🎉</h2><p>You earned ₱${amt}!!😍🍍🎉</p>`;
    el.style.display = 'block';
    setTimeout(() => el.style.display='none', 3000);
}

// --- Finance (Sync Live) ---
async function submitWithdraw() {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const addr = document.getElementById('wAddr').value;
    if(amt > uData.balance || amt < 1) return alert("Min 1 PHP / Insufficient");

    await db.collection('withdrawals').add({ user: rawUser, addr, amt, status: 'pending', time: Date.now() });
    await db.collection('users').doc(userDocId).update({ balance: firebase.firestore.FieldValue.increment(-amt) });
    alert("Request Live!");
}

function syncWithdrawals() {
    // User View
    db.collection('withdrawals').where('user', '==', rawUser).orderBy('time', 'desc').onSnapshot(snap => {
        let h = '<table><tr><th>Amt</th><th>Status</th><th>Date</th></tr>';
        snap.forEach(d => {
            const data = d.data();
            h += `<tr><td>₱${data.amt}</td><td>${data.status}</td><td>${new Date(data.time).toLocaleDateString()}</td></tr>`;
        });
        document.getElementById('user-history').innerHTML = h + '</table>';
    });
}

// --- Chat ---
async function sendChat() {
    const t = document.getElementById('chatInput').value;
    if(!t) return;
    if(Date.now() - (uData.lastChat || 0) < 120000) return alert("Cooldown: 2m");

    await db.collection('messages').add({ user: rawUser, text: t, time: Date.now() });
    await db.collection('users').doc(userDocId).update({ 
        balance: firebase.firestore.FieldValue.increment(0.01),
        lastChat: Date.now() 
    });
    document.getElementById('chatInput').value = "";
}

function loadChat() {
    db.collection('messages').orderBy('time', 'desc').limit(30).onSnapshot(snap => {
        document.getElementById('chat-box').innerHTML = snap.docs.map(d => `<div class="msg"><b>${d.data().user}:</b> ${d.data().text}</div>`).join('');
    });
}

// --- Admin ---
function checkAdmin() {
    if(prompt("Owner Code:") === "Propetas6") {
        showPage('p-admin');
        db.collection('withdrawals').orderBy('status', 'desc').onSnapshot(snap => {
            let h = '<table><tr style="color:black"><th>User</th><th>Addr</th><th>Amt</th><th>Action</th></tr>';
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr style="color:black"><td>${d.user}</td><td>${d.addr}</td><td>₱${d.amt}</td>
                <td><button onclick="approveW('${doc.id}')">Approve</button></td></tr>`;
            });
            document.getElementById('admin-reqs').innerHTML = h + '</table>';
        });
    }
}
async function approveW(id) { await db.collection('withdrawals').doc(id).update({ status: 'approved' }); }

// --- Helpers ---
function showPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(p).classList.add('active');
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
    document.getElementById('footer-time').innerText = new Date().toLocaleString();
}, 1000);

init();
