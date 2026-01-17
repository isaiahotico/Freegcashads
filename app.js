
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc, updateDoc, increment } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* --- TELEGRAM SETUP --- */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const userId = user?.id ? user.id.toString() : "guest_user";
const username = user ? `@${user.username || user.first_name}` : "Guest";

document.getElementById("userBar").innerText = "👤 User: " + username;

/* --- STATE & SYNC --- */
let userBalance = 0;
let userCooldowns = {};

// Real-time sync user data
onSnapshot(doc(db, "users", userId), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        userBalance = data.balance || 0;
        userCooldowns = data.cooldowns || {};
        document.getElementById('balVal').innerText = userBalance.toFixed(3);
        renderTasks();
    } else {
        setDoc(doc(db, "users", userId), { balance: 0, username: username, cooldowns: {} });
    }
});

// Real-time sync global stats
onSnapshot(doc(db, "stats", "global"), (s) => {
    if(s.exists()) document.getElementById('globalPaid').innerText = s.data().totalPaid.toFixed(2);
});

/* --- ADS CONFIG --- */
const configs = {
    adsArea: { reward: 0.02, cd: 300000, tags: ['10276123','10337795','10337853'], type: 'inter' },
    signIn: { reward: 0.025, cd: 10800000, tags: ['10276123','10337795','10337853'], type: 'inter' },
    gift: { reward: 0.02, cd: 1200000, tags: ['10276123','10337795','10337853'], type: 'pop' }
};

window.nav = (id) => {
    document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'adsPage') triggerAutoAd('10337853');
    if(id === 'signInPage') triggerAutoAd('10276123');
    if(id === 'giftPage') triggerAutoAd('10337795');
};

function triggerAutoAd(tag) {
    if(window['show_'+tag]) {
        window['show_'+tag]({
            type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

/* --- TASK LOGIC --- */
window.watchAd = (group, tag, idx) => {
    const fn = window['show_' + tag];
    const promise = (configs[group].type === 'pop') ? fn('pop') : fn();
    
    promise.then(() => {
        alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
        document.getElementById(`btn-w-${group}-${idx}`).style.display = 'none';
        document.getElementById(`btn-c-${group}-${idx}`).style.display = 'block';
    }).catch(() => alert("Ad error"));
};

window.claim = async (group, idx) => {
    const taskId = `${group}_${idx}`;
    const reward = configs[group].reward;
    const nextReady = Date.now() + configs[group].cd;

    userCooldowns[taskId] = nextReady;
    await updateDoc(doc(db, "users", userId), {
        balance: increment(reward),
        cooldowns: userCooldowns
    });
};

function renderTasks() {
    ['adsArea', 'signIn', 'gift'].forEach(group => {
        const cont = document.getElementById(`${group}List`);
        if(!cont) return;
        cont.innerHTML = '';
        configs[group].tags.forEach((tag, i) => {
            const isCd = userCooldowns[`${group}_${i}`] > Date.now();
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h4>Task #${i+1}</h4>
                <button class="btn" id="btn-w-${group}-${i}" onclick="watchAd('${group}','${tag}',${i})" ${isCd?'disabled':''}>
                    ${isCd ? 'Cooldown' : '🍍 Watch Ad 🍍'}
                </button>
                <button class="btn" id="btn-c-${group}-${i}" style="display:none; background:var(--gold)" onclick="claim('${group}',${i})">Claim ₱${configs[group].reward}</button>
                <div id="timer-${group}-${i}" style="color:red; font-size:0.8rem"></div>
            `;
            cont.appendChild(card);
        });
    });
}

/* --- WITHDRAWAL SYSTEM --- */
window.handleWithdraw = async (method) => {
    const amt = parseFloat(document.getElementById(method === 'GCash' ? 'gcashAmt' : 'fpAmt').value);
    const detail = document.getElementById(method === 'GCash' ? 'gcashNum' : 'fpEmail').value;

    if(amt > userBalance || amt <= 0 || !detail) return alert("Invalid data or low balance");

    await addDoc(collection(db, "withdrawals"), {
        userId, username, method, detail, amount: amt, status: 'Pending', timestamp: Date.now()
    });
    await updateDoc(doc(db, "users", userId), { balance: increment(-amt) });
    alert("Request Sent!");
};

// Sync Withdrawal History
const qHistory = query(collection(db, "withdrawals"), where("userId", "==", userId), orderBy("timestamp", "desc"), limit(10));
onSnapshot(qHistory, (snap) => {
    const body = document.getElementById('historyBody');
    body.innerHTML = '';
    snap.forEach(doc => {
        const d = doc.data();
        body.innerHTML += `<tr><td>${new Date(d.timestamp).toLocaleDateString()}</td><td>${d.method}</td><td>₱${d.amount}</td><td class="status-${d.status.toLowerCase()}">${d.status}</td></tr>`;
    });
});

/* --- ADMIN DASHBOARD --- */
window.adminLogin = () => {
    if(prompt("Password:") === "Propetas6") {
        nav('adminPage');
        loadAdminData();
    }
};

function loadAdminData() {
    const q = query(collection(db, "withdrawals"), where("status", "==", "Pending"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const cont = document.getElementById('adminList');
        cont.innerHTML = '';
        snap.forEach(dSnap => {
            const d = dSnap.data();
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <p>${d.username} | ${d.method} | ₱${d.amount}</p>
                <p>${d.detail}</p>
                <button onclick="updateReq('${dSnap.id}', 'Paid', ${d.amount})">Approve</button>
                <button onclick="updateReq('${dSnap.id}', 'Denied', ${d.amount}, '${d.userId}')">Deny</button>
            `;
            cont.appendChild(div);
        });
    });
}

window.updateReq = async (id, status, amt, uId) => {
    await updateDoc(doc(db, "withdrawals", id), { status });
    if(status === 'Paid') {
        await updateDoc(doc(db, "stats", "global"), { totalPaid: increment(amt) });
    } else {
        await updateDoc(doc(db, "users", uId), { balance: increment(amt) }); // Refund
    }
};

// Timer Loop
setInterval(() => {
    ['adsArea', 'signIn', 'gift'].forEach(group => {
        configs[group].tags.forEach((_, i) => {
            const el = document.getElementById(`timer-${group}-${i}`);
            if(!el) return;
            const rem = userCooldowns[`${group}_${i}`] - Date.now();
            if(rem > 0) {
                const m = Math.floor(rem / 60000);
                const s = Math.floor((rem % 60000) / 1000);
                el.innerText = `Wait: ${m}m ${s}s`;
            } else { el.innerText = ""; }
        });
    });
    // USDT calc
    const fpAmt = parseFloat(document.getElementById('fpAmt').value) || 0;
    document.getElementById('usdtDisplay').innerText = (fpAmt * 0.017).toFixed(4) + " USDT";
}, 1000);
