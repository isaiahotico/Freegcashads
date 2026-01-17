
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

// FAST TELEGRAM INIT
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const uid = user ? user.id.toString() : "guest_123";
const username = user ? (user.username ? `@${user.username}` : user.first_name) : "Guest";
document.getElementById("userBar").innerText = "👤 " + username;

let myBalance = 0;
let myCooldowns = {};

// TASK CONFIGS
const cfg = {
    adsArea: { reward: 0.02, cd: 300000, tags: ['10276123','10337795','10337853'], type: 'inter' },
    signIn: { reward: 0.025, cd: 10800000, tags: ['10276123','10337795','10337853'], type: 'inter' },
    gift: { reward: 0.02, cd: 1200000, tags: ['10276123','10337795','10337853'], type: 'pop' }
};

// INITIAL RENDER (Prevents Unclickable buttons while waiting for Firebase)
renderAllLists();

// REAL-TIME FIREBASE SYNC
onSnapshot(doc(db, "users", uid), (s) => {
    if (s.exists()) {
        myBalance = s.data().balance || 0;
        myCooldowns = s.data().cooldowns || {};
        document.getElementById("balVal").innerText = myBalance.toFixed(3);
        renderAllLists();
    } else {
        setDoc(doc(db, "users", uid), { balance: 0, username, cooldowns: {} });
    }
}, (err) => console.error("Firestore Error:", err));

onSnapshot(doc(db, "stats", "global"), (s) => {
    if(s.exists()) document.getElementById("globalPaid").innerText = s.data().totalPaid.toFixed(2);
});

// NAVIGATION
window.nav = (id) => {
    document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'adsPage') autoAd('10337853');
    if(id === 'signInPage') autoAd('10276123');
    if(id === 'giftPage') autoAd('10337795');
};

function autoAd(tag) {
    if(window['show_'+tag]) window['show_'+tag]({
        type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });
}

// AD LOGIC
window.watchAd = (group, tag, i) => {
    const fn = window['show_' + tag];
    if(!fn) return alert("SDK Loading...");
    
    const call = (cfg[group].type === 'pop') ? fn('pop') : fn();
    call.then(() => {
        alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
        document.getElementById(`w-${group}-${i}`).style.display = "none";
        document.getElementById(`c-${group}-${i}`).style.display = "block";
    }).catch(() => alert("Ad not ready."));
};

window.claimReward = async (group, i) => {
    const key = `${group}_${i}`;
    const reward = cfg[group].reward;
    myCooldowns[key] = Date.now() + cfg[group].cd;

    await updateDoc(doc(db, "users", uid), {
        balance: increment(reward),
        cooldowns: myCooldowns
    });
};

function renderAllLists() {
    ['adsArea', 'signIn', 'gift'].forEach(g => {
        const list = document.getElementById(`${g}List`);
        if(!list) return;
        list.innerHTML = '';
        cfg[g].tags.forEach((tag, i) => {
            const isCd = (myCooldowns[`${g}_${i}`] || 0) > Date.now();
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h4>Task #${i+1}</h4>
                <button class="btn" id="w-${g}-${i}" onclick="watchAd('${g}','${tag}',${i})" ${isCd?'disabled':''}>
                    ${isCd ? 'Wait...' : '🤑 Start Ad 🤑'}
                </button>
                <button class="btn claim-btn" id="c-${g}-${i}" onclick="claimReward('${g}',${i})">CLAIM ₱${cfg[g].reward}</button>
                <div id="tmr-${g}-${i}" class="timer"></div>
            `;
            list.appendChild(card);
        });
    });
}

// WITHDRAWALS
window.requestWithdraw = async (method) => {
    const amt = parseFloat(document.getElementById(method==='GCash'?'gcashAmt':'fpAmt').value);
    const detail = document.getElementById(method==='GCash'?'gcashNum':'fpEmail').value;
    if(amt > myBalance || amt <= 0 || !detail) return alert("Invalid amount or details");

    await addDoc(collection(db, "withdrawals"), { uid, username, method, detail, amount: amt, status: 'Pending', ts: Date.now() });
    await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
    alert("Withdrawal submitted!");
};

// SYNC HISTORY
onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("ts", "desc"), limit(10)), (s) => {
    const body = document.getElementById("histBody");
    body.innerHTML = '';
    s.forEach(d => {
        const r = d.data();
        body.innerHTML += `<tr><td>₱${r.amount}</td><td style="color:${r.status==='Pending'?'orange':'#2ecc71'}">${r.status}</td></tr>`;
    });
});

// ADMIN
window.adminAuth = () => { if(prompt("Password:") === "Propetas6") { nav('adminPage'); loadAdmin(); } };

function loadAdmin() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending"), orderBy("ts", "desc")), (s) => {
        const al = document.getElementById("adminList");
        al.innerHTML = '';
        s.forEach(ds => {
            const d = ds.data();
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <p>${d.username} | ₱${d.amount} | ${d.method}</p>
                <small>${d.detail}</small><br>
                <button onclick="updateReq('${ds.id}', 'Paid', ${d.amount})">Approve</button>
                <button onclick="updateReq('${ds.id}', 'Denied', ${d.amount}, '${d.uid}')">Deny</button>
            `;
            al.appendChild(div);
        });
    });
}

window.updateReq = async (id, status, amt, targetUid) => {
    await updateDoc(doc(db, "withdrawals", id), { status });
    if(status === 'Paid') await updateDoc(doc(db, "stats", "global"), { totalPaid: increment(amt) });
    else await updateDoc(doc(db, "users", targetUid), { balance: increment(amt) });
};

// TIMER LOOP
setInterval(() => {
    ['adsArea', 'signIn', 'gift'].forEach(g => {
        cfg[g].tags.forEach((_, i) => {
            const el = document.getElementById(`tmr-${g}-${i}`);
            if(!el) return;
            const diff = (myCooldowns[`${g}_${i}`] || 0) - Date.now();
            if(diff > 0) {
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                el.innerText = `Ready in: ${m}m ${s}s`;
            } else {
                el.innerText = "";
            }
        });
    });
    const fpAmt = parseFloat(document.getElementById('fpAmt').value) || 0;
    document.getElementById('usdtDisplay').innerText = (fpAmt * 0.017).toFixed(4) + " USDT";
}, 1000);
