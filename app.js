
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update, push, increment } from "firebase/database";

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
const db = getDatabase(app);

/* --- FAST TELEGRAM INIT --- */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const uid = user ? user.id.toString() : "guest_user";
const username = user ? (user.username ? `@${user.username}` : user.first_name) : "Guest";

// Show name instantly
document.getElementById("userBar").innerText = "👤 " + username;

let myBal = 0;
let myCD = {};

/* --- REALTIME DATA SYNC --- */
onValue(ref(db, 'users/' + uid), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        myBal = data.balance || 0;
        myCD = data.cooldowns || {};
        document.getElementById("balVal").innerText = myBal.toFixed(3);
    } else {
        // Initial setup for new user
        set(ref(db, 'users/' + uid), { balance: 0, username: username, cooldowns: {} });
    }
    renderLists();
});

onValue(ref(db, 'stats/global'), (s) => {
    const val = s.val();
    if(val) document.getElementById("globalPaid").innerText = val.totalPaid.toFixed(2);
});

/* --- ADS CONFIGS --- */
const cfg = {
    adsArea: { reward: 0.02, cd: 300000, tags: ['10276123','10337795','10337853'], type: 'inter' },
    signIn: { reward: 0.025, cd: 10800000, tags: ['10276123','10337795','10337853'], type: 'inter' },
    gift: { reward: 0.02, cd: 1200000, tags: ['10276123','10337795','10337853'], type: 'pop' }
};

window.nav = (page) => {
    document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
    document.getElementById(page).classList.add('active');
    
    if(page === 'adsPage') runAuto('10337853');
    if(page === 'signInPage') runAuto('10276123');
    if(page === 'giftPage') runAuto('10337795');
};

function runAuto(tag) {
    if(window['show_'+tag]) window['show_'+tag]({
        type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });
}

/* --- BUTTON & AD ACTIONS --- */
window.watchAd = (group, tag, i) => {
    const adFn = window['show_' + tag];
    if(!adFn) return alert("SDK loading...");

    const promise = (cfg[group].type === 'pop') ? adFn('pop') : adFn();
    promise.then(() => {
        alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
        document.getElementById(`w-${group}-${i}`).style.display = "none";
        document.getElementById(`c-${group}-${i}`).style.display = "block";
    }).catch(() => alert("Ad error."));
};

window.claim = (group, i) => {
    const key = `${group}_${i}`;
    const reward = cfg[group].reward;
    const cdTime = Date.now() + cfg[group].cd;

    const updates = {};
    updates[`users/${uid}/balance`] = increment(reward);
    updates[`users/${uid}/cooldowns/${key}`] = cdTime;
    update(ref(db), updates);
};

function renderLists() {
    ['adsArea', 'signIn', 'gift'].forEach(g => {
        const container = document.getElementById(`${g}List`);
        if(!container) return;
        container.innerHTML = '';
        cfg[g].tags.forEach((tag, i) => {
            const isLocked = (myCD[`${g}_${i}`] || 0) > Date.now();
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <h4>Task #${i+1}</h4>
                <button class="btn" id="w-${g}-${i}" onclick="watchAd('${g}','${tag}',${i})" ${isLocked?'disabled':''}>
                    ${isLocked ? 'Locked' : '🤑 Watch Ad 🤑'}
                </button>
                <button class="btn claim-btn" id="c-${g}-${i}" onclick="claim('${g}',${i})">CLAIM ₱${cfg[g].reward}</button>
                <div id="tmr-${g}-${i}" class="timer"></div>
            `;
            container.appendChild(div);
        });
    });
}

/* --- WITHDRAWALS --- */
window.doWithdraw = (method) => {
    const amtField = method === 'GCash' ? 'gcashAmt' : 'fpAmt';
    const detailField = method === 'GCash' ? 'gcashNum' : 'fpEmail';
    const amt = parseFloat(document.getElementById(amtField).value);
    const detail = document.getElementById(detailField).value;

    if(amt > myBal || amt <= 0 || !detail) return alert("Check balance/details");

    const wKey = push(ref(db, 'withdrawals')).key;
    const updates = {};
    updates[`withdrawals/${wKey}`] = { uid, username, method, detail, amount: amt, status: 'Pending', ts: Date.now() };
    updates[`users/${uid}/balance`] = increment(-amt);
    update(ref(db), updates);
    alert("Request Sent!");
};

// Sync Withdrawal History
onValue(ref(db, 'withdrawals'), (s) => {
    const data = s.val();
    const body = document.getElementById("histBody");
    body.innerHTML = '';
    if(!data) return;
    Object.values(data).filter(w => w.uid === uid).sort((a,b)=>b.ts-a.ts).slice(0,10).forEach(w => {
        body.innerHTML += `<tr><td>₱${w.amount}</td><td style="color:${w.status==='Pending'?'orange':'#2ecc71'}">${w.status}</td></tr>`;
    });
});

/* --- ADMIN --- */
window.adminAuth = () => {
    if(prompt("Password:") === "Propetas6") { nav('adminPage'); loadAdmin(); }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), (s) => {
        const al = document.getElementById("adminRequests");
        al.innerHTML = '';
        const data = s.val();
        if(!data) return;
        Object.keys(data).forEach(id => {
            const w = data[id];
            if(w.status !== 'Pending') return;
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <p>${w.username} | ₱${w.amount} | ${w.method}</p>
                <small>${w.detail}</small><br>
                <button onclick="processReq('${id}', 'Paid', ${w.amount})">Approve</button>
                <button onclick="processReq('${id}', 'Denied', ${w.amount}, '${w.uid}')">Deny</button>
            `;
            al.appendChild(div);
        });
    });
}

window.processReq = (id, status, amt, targetUid) => {
    const updates = {};
    updates[`withdrawals/${id}/status`] = status;
    if(status === 'Paid') {
        updates[`stats/global/totalPaid`] = increment(amt);
    } else {
        updates[`users/${targetUid}/balance`] = increment(amt);
    }
    update(ref(db), updates);
};

/* --- TIMERS --- */
setInterval(() => {
    ['adsArea', 'signIn', 'gift'].forEach(g => {
        cfg[g].tags.forEach((_, i) => {
            const el = document.getElementById(`tmr-${g}-${i}`);
            if(!el) return;
            const diff = (myCD[`${g}_${i}`] || 0) - Date.now();
            if(diff > 0) {
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                el.innerText = `Wait: ${m}m ${s}s`;
            } else { el.innerText = ""; }
        });
    });
    const fpAmt = parseFloat(document.getElementById('fpAmt').value) || 0;
    document.getElementById('usdtVal').innerText = (fpAmt * 0.017).toFixed(4) + " USDT";
}, 1000);
