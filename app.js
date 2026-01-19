
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, orderBy, limit, increment, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const tg = window.Telegram?.WebApp;
tg?.ready();
const username = tg?.initDataUnsafe?.user?.username ? `@${tg.initDataUnsafe.user.username}` : "Guest_" + Math.floor(Math.random()*9999);

let user = { balance: 0, ads_d: 0, ads_w: 0, ads_t: 0, cooldowns: {} };
let p = { hist: 1, admin: 1 };
let viewUser = null;

async function init() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { balance: 0, ads_d: 0, ads_w: 0, ads_t: 0, lastD: Date.now(), lastW: Date.now(), refClaimable: 0, lastActive: Date.now() });
    }
    onSnapshot(userRef, (s) => { user = s.data(); updateUI(); checkResets(userRef); });
    buildTaskAreas();
    syncOnline();
    syncChat();
    setInterval(() => updateDoc(userRef, { lastActive: Date.now() }), 30000);
    setInterval(tick, 1000);
}

/* ================= ADS ENGINE ================= */
function buildTaskAreas() {
    const data = [
        { key: 'ads', tasks: [10276123, 10337795, 10337853], r: 0.02, c: 300000 },
        { key: 'signin', tasks: [10276123, 10337795, 10337853], r: 0.025, c: 10800000 },
        { key: 'gift', tasks: [10276123, 10337795, 10337853], r: 0.02, c: 7200000, type: 'pop' },
        { key: 'bonus', tasks: [10276123], r: 0.015, c: 600000 }
    ];

    data.forEach(area => {
        const cont = document.getElementById(`cont-${area.key}`);
        if(!cont) return;
        area.tasks.forEach((zone, i) => {
            const id = `${area.key}_${i}`;
            cont.innerHTML += `
                <div class="card">
                    <button id="btn-watch-${id}" onclick="watchAd('${id}', ${zone}, '${area.type || 'inter'}')">🤑 Task #${i+1} Watched Ads</button>
                    <button id="btn-claim-${id}" class="unlock-btn" onclick="claimAd('${id}', ${area.r}, ${area.c})">🍍 Claim Reward 🍍</button>
                    <div id="tmr-${id}" style="font-size:10px; color:red;"></div>
                </div>`;
        });
    });
}

window.watchAd = (id, zone, type) => {
    const trigger = type === 'pop' ? window[`show_${zone}`]('pop') : window[`show_${zone}`]();
    trigger.then(() => {
        document.getElementById(`btn-watch-${id}`).style.display = 'none';
        document.getElementById(`btn-claim-${id}`).style.display = 'block';
    }).catch(() => alert("Ad not available. Check Connection/WiFi."));
};

window.claimAd = async (id, r, cd) => {
    const uRef = doc(db, "users", username);
    await updateDoc(uRef, {
        balance: increment(r), ads_d: increment(1), ads_w: increment(1), ads_t: increment(1),
        [`cooldowns.${id}`]: Date.now() + cd
    });
    if (user.referredBy) {
        await updateDoc(doc(db, "users", user.referredBy), { refClaimable: increment(r * 0.1) });
    }
    document.getElementById(`btn-claim-${id}`).style.display = 'none';
    document.getElementById(`btn-watch-${id}`).style.display = 'block';
    document.getElementById('reward-pop').style.display = 'block';
};

/* ================= WITHDRAWALS ================= */
window.withdraw = async (method) => {
    if (user.balance < 1) return alert("Min ₱1.00");
    const info = document.getElementById('drawInfo').value;
    let converted = `₱${user.balance.toFixed(2)}`;
    if (method === 'FaucetPay') converted = `${(user.balance / 56).toFixed(4)} USDT`;

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: user.balance, method: method,
        info: info, converted: converted, status: "Pending", timestamp: Date.now()
    });
    await updateDoc(doc(db, "users", username), { balance: 0 });
    alert("Request Sent!");
};

function syncWithdrawals() {
    onSnapshot(query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc")), (s) => {
        const sliced = s.docs.slice((p.hist-1)*10, p.hist*10);
        document.getElementById('histBody').innerHTML = sliced.map(d => `
            <tr><td>${d.data().method}</td><td>${d.data().info}</td><td>${d.data().converted}</td><td>${d.data().status}</td></tr>
        `).join('');
    });
}

/* ================= OWNER DASHBOARD ================= */
window.openAdmin = () => { if(prompt("Pass:") === "Propetas6") { navTo('page-admin'); syncAdmin(); } };
function syncAdmin() {
    onSnapshot(query(collection(db, "withdrawals"), orderBy("status", "desc"), orderBy("timestamp", "desc")), (s) => {
        const sliced = s.docs.slice((p.admin-1)*10, p.admin*10);
        document.getElementById('adminBody').innerHTML = sliced.map(d => `
            <tr><td class="user-link" onclick="viewProfile('${d.data().user}')">${d.data().user}</td><td>${d.data().method}</td><td>${d.data().info}</td><td>${d.data().converted}</td><td><button onclick="updStat('${d.id}','Paid')">Pay</button></td></tr>
        `).join('');
    });
}
window.updStat = async (id, s) => updateDoc(doc(db, "withdrawals", id), { status: s });

/* ================= UTILS ================= */
window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-withdraw') syncWithdrawals();
    if(id === 'page-signin') window.show_10276123({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }});
    if(id === 'page-gift') window.show_10337795({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }});
};

window.viewProfile = async (uid) => {
    viewUser = uid;
    navTo('page-profile');
    const d = (await getDoc(doc(db, "users", uid))).data();
    document.getElementById('prof-user').innerText = uid;
    document.getElementById('ads-d').innerText = d.ads_d;
    document.getElementById('ads-w').innerText = d.ads_w;
    document.getElementById('ads-t').innerText = d.ads_t;
    document.getElementById('msg-icon').classList.toggle('hidden', uid === username);
};

function syncOnline() {
    onSnapshot(query(collection(db, "users"), where("lastActive", ">", Date.now() - 60000)), (s) => {
        document.getElementById('onlineBody').innerHTML = s.docs.map(d => `<tr><td class="user-link" onclick="viewProfile('${d.id}')">${d.id}</td><td>✅ Online</td></tr>`).join('');
    });
}

window.linkReferrer = async () => {
    const code = document.getElementById('refInput').value;
    const r = await getDoc(doc(db, "users", code));
    if(r.exists()) { await updateDoc(doc(db, "users", username), { referredBy: code }); alert("Linked!"); }
};

window.claimRef = async () => {
    if(user.refClaimable > 0) { await updateDoc(doc(db, "users", username), { balance: increment(user.refClaimable), refClaimable: 0 }); alert("Claimed!"); }
};

function tick() {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString();
    Object.keys(user.cooldowns || {}).forEach(id => {
        const btn = document.getElementById(`btn-watch-${id}`), tmr = document.getElementById(`tmr-${id}`), target = user.cooldowns[id];
        if (btn && Date.now() < target) {
            btn.disabled = true; tmr.innerText = Math.ceil((target - Date.now())/1000) + "s left";
        } else if(btn) { btn.disabled = false; tmr.innerText = ""; }
    });
}

function checkResets(ref) {
    const now = Date.now();
    if(now - user.lastD > 86400000) updateDoc(ref, { ads_d: 0, lastD: now });
    if(now - user.lastW > 604800000) updateDoc(ref, { ads_w: 0, lastW: now });
}

window.updateUI = () => {
    document.getElementById('topBalance').innerText = user.balance.toFixed(3);
    document.getElementById('drawBalance').innerText = user.balance.toFixed(3);
    document.getElementById('userBar').innerText = `👤 ${username}`;
    document.getElementById('refBonus').innerText = user.refClaimable.toFixed(3);
};

window.openExternal = (url) => tg.openLink(url);
function syncChat() {
    onSnapshot(query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(15)), (s) => {
        document.getElementById('chatBox').innerHTML = s.docs.map(d => `<div><b>${d.data().u}:</b> ${d.data().t}</div>`).reverse().join('');
    });
}
window.sendMsg = async () => {
    const i = document.getElementById('chatInput');
    await addDoc(collection(db, "messages"), { u: username, t: i.value, timestamp: serverTimestamp() });
    i.value = "";
};

init();
