
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, increment, collection, addDoc, query, where, orderBy, limit } from "firebase/firestore";

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

/* --- REAL-TIME TELEGRAM USER --- */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
const user = tg?.initDataUnsafe?.user;
const uid = user ? user.id.toString() : "guest_user";
const username = user ? (user.username ? `@${user.username}` : user.first_name) : "Guest User";

// Immediate Fast Display
document.getElementById("userBar").innerText = "👤 " + username;

let localBal = 0;
let localCD = {};

/* --- DATA SYNC --- */
onSnapshot(doc(db, "users", uid), (s) => {
    if (s.exists()) {
        localBal = s.data().balance || 0;
        localCD = s.data().cooldowns || {};
        document.getElementById("balVal").innerText = localBal.toFixed(3);
        renderTasks();
    } else {
        setDoc(doc(db, "users", uid), { balance: 0, username, cooldowns: {} });
    }
});

onSnapshot(doc(db, "stats", "global"), (s) => {
    if(s.exists()) document.getElementById("totalPaid").innerText = s.data().totalPaid.toFixed(2);
});

/* --- CONFIGS --- */
const cfg = {
    adsArea: { reward: 0.02, cd: 300000, tags: ['10276123','10337795','10337853'], type: 'inter' },
    signIn: { reward: 0.025, cd: 10800000, tags: ['10276123','10337795','10337853'], type: 'inter' },
    gift: { reward: 0.02, cd: 1200000, tags: ['10276123','10337795','10337853'], type: 'pop' }
};

/* --- NAVIGATION & AUTO ADS --- */
window.nav = (page) => {
    document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
    document.getElementById(page).classList.add('active');
    
    // Auto Interstitial requirements
    if(page === 'adsPage') runAutoAd('10337853');
    if(page === 'signInPage') runAutoAd('10276123');
    if(page === 'giftPage') runAutoAd('10337795');
};

function runAutoAd(tag) {
    if (window['show_' + tag]) {
        window['show_' + tag]({
            type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

/* --- AD & REWARD LOGIC --- */
window.watchAd = (group, tag, i) => {
    const btn = document.getElementById(`w-${group}-${i}`);
    const claimBtn = document.getElementById(`c-${group}-${i}`);
    
    const adFn = window['show_' + tag];
    if (!adFn) return alert("Ad SDK Loading...");

    const call = (cfg[group].type === 'pop') ? adFn('pop') : adFn();

    call.then(() => {
        alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
        btn.style.display = "none";
        claimBtn.style.display = "block";
    }).catch(() => alert("Ad failed to load."));
};

window.claimReward = async (group, i) => {
    const id = `${group}_${i}`;
    const amount = cfg[group].reward;
    localCD[id] = Date.now() + cfg[group].cd;

    await updateDoc(doc(db, "users", uid), {
        balance: increment(amount),
        cooldowns: localCD
    });
};

function renderTasks() {
    ['adsArea', 'signIn', 'gift'].forEach(group => {
        const container = document.getElementById(`${group}List`);
        if (!container) return;
        container.innerHTML = '';
        
        cfg[group].tags.forEach((tag, i) => {
            const cdTime = localCD[`${group}_${i}`] || 0;
            const isLocked = Date.now() < cdTime;
            
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h4>Task #${i+1}</h4>
                <button class="btn" id="w-${group}-${i}" onclick="watchAd('${group}','${tag}',${i})" ${isLocked?'disabled':''}>
                    ${isLocked ? 'Locked' : '🤑 Watch Ad 🤑'}
                </button>
                <button class="btn claim-btn" id="c-${group}-${i}" onclick="claimReward('${group}',${i})">🎁 CLAIM ₱${cfg[group].reward} 🎁</button>
                <div id="tmr-${group}-${i}" class="timer"></div>
            `;
            container.appendChild(card);
        });
    });
}

/* --- WITHDRAWALS --- */
window.withdraw = async (method) => {
    const amtId = method === 'GCash' ? 'gcashAmt' : 'fpAmt';
    const detailId = method === 'GCash' ? 'gcashNum' : 'fpEmail';
    const amt = parseFloat(document.getElementById(amtId).value);
    const detail = document.getElementById(detailId).value;

    if (amt > localBal || amt <= 0 || !detail) return alert("Error: Check balance or info");

    await addDoc(collection(db, "withdrawals"), {
        uid, username, method, detail, amount: amt, status: 'Pending', ts: Date.now()
    });
    await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
    alert("Request Sent Successfully!");
};

// Real-time History
const qHist = query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("ts", "desc"), limit(10));
onSnapshot(qHist, (s) => {
    const body = document.getElementById("histBody");
    body.innerHTML = '';
    s.forEach(d => {
        const row = d.data();
        body.innerHTML += `<tr><td>${row.method}</td><td>₱${row.amount}</td><td style="color:${row.status==='Pending'?'orange':'#2ecc71'}">${row.status}</td></tr>`;
    });
});

/* --- ADMIN --- */
window.adminAuth = () => {
    if (prompt("Access Password:") === "Propetas6") {
        nav('adminPage');
        loadAdmin();
    }
};

function loadAdmin() {
    const q = query(collection(db, "withdrawals"), where("status", "==", "Pending"), orderBy("ts", "desc"));
    onSnapshot(q, (s) => {
        const cont = document.getElementById("adminRequests");
        cont.innerHTML = '';
        s.forEach(docSnap => {
            const d = docSnap.data();
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <p>${d.username} | ${d.method} | ₱${d.amount}</p>
                <p><small>${d.detail}</small></p>
                <button onclick="processReq('${docSnap.id}', 'Paid', ${d.amount})">Approve</button>
                <button onclick="processReq('${docSnap.id}', 'Denied', ${d.amount}, '${d.uid}')">Deny</button>
            `;
            cont.appendChild(card);
        });
    });
}

window.processReq = async (id, status, amt, targetUid) => {
    await updateDoc(doc(db, "withdrawals", id), { status });
    if(status === 'Paid') {
        await updateDoc(doc(db, "stats", "global"), { totalPaid: increment(amt) });
    } else {
        await updateDoc(doc(db, "users", targetUid), { balance: increment(amt) });
    }
};

/* --- LIVE TIMERS & CONVERTER --- */
setInterval(() => {
    ['adsArea', 'signIn', 'gift'].forEach(group => {
        cfg[group].tags.forEach((_, i) => {
            const el = document.getElementById(`tmr-${group}-${i}`);
            if(!el) return;
            const rem = localCD[`${group}_${i}`] - Date.now();
            if(rem > 0) {
                const m = Math.floor(rem / 60000);
                const s = Math.floor((rem % 60000) / 1000);
                el.innerText = `Ready in: ${m}m ${s}s`;
            } else {
                el.innerText = "";
            }
        });
    });
    const fpAmt = parseFloat(document.getElementById('fpAmt').value) || 0;
    document.getElementById('usdtVal').innerText = (fpAmt * 0.017).toFixed(4) + " USDT";
}, 1000);
