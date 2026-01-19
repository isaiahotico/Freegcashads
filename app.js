
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

/* ================= TG IDENTITY ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const username = tg?.initDataUnsafe?.user?.username ? `@${tg.initDataUnsafe.user.username}` : "Guest_" + Math.floor(Math.random()*9999);
const startParam = tg?.initDataUnsafe?.start_param;

let user = { balance: 0, adsD: 0, adsW: 0, adsT: 0, cooldowns: {} };
let p = { hist: 1, admin: 1 };
let viewUser = null;

/* ================= INITIALIZE ================= */
async function init() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        const refBy = (startParam && `@${startParam}` !== username) ? `@${startParam}` : null;
        await setDoc(userRef, { 
            balance: 0, adsD: 0, adsW: 0, adsT: 0, 
            lastD: Date.now(), lastW: Date.now(),
            referredBy: refBy, refClaimable: 0, lastActive: Date.now() 
        });
    }

    onSnapshot(userRef, (s) => {
        user = s.data();
        checkResets(userRef);
        updateUI();
    });

    setInterval(() => updateDoc(userRef, { lastActive: Date.now() }), 30000);
    setupTasks();
    syncOnline();
    syncChat();
    setInterval(tick, 1000);
}

/* ================= AD TRACKING & REWARDS ================= */
function checkResets(ref) {
    const now = Date.now();
    if (now - user.lastD > 86400000) updateDoc(ref, { adsD: 0, lastD: now });
    if (now - user.lastW > 604800000) updateDoc(ref, { adsW: 0, lastW: now });
}

window.triggerAd = (key, id) => {
    const rewards = { signin: 0.02, ads: 0.02, gift: 0.02, bonus: 0.015 };
    const z = key === 'ads' ? 10337853 : (key === 'gift' ? 10337795 : 10276123);

    window[`show_${z}`]().then(async () => {
        const r = rewards[key];
        await updateDoc(doc(db, "users", username), {
            balance: increment(r), adsD: increment(1), adsW: increment(1), adsT: increment(1),
            [`cooldowns.${id}`]: Date.now() + 300000
        });
        if (user.referredBy) {
            await updateDoc(doc(db, "users", user.referredBy), { refClaimable: increment(r * 0.1) });
        }
        showPop(r);
    });
};

/* ================= NAVIGATION & PROFILES ================= */
window.navTo = (id, targetUser = null) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'page-profile') loadProfile(targetUser || username);
    if (id === 'page-withdraw') syncHist();
};

async function loadProfile(target) {
    viewUser = target;
    const snap = await getDoc(doc(db, "users", target));
    const d = snap.data();
    document.getElementById('prof-name').innerText = target;
    document.getElementById('ads-d').innerText = d.adsD;
    document.getElementById('ads-w').innerText = d.adsW;
    document.getElementById('ads-t').innerText = d.adsT;
    document.getElementById('msg-action').classList.toggle('hidden', target === username);
}

/* ================= ONLINE USERS ================= */
function syncOnline() {
    const q = query(collection(db, "users"), where("lastActive", ">", Date.now() - 60000));
    onSnapshot(q, (s) => {
        document.getElementById('onlineBody').innerHTML = s.docs.map(d => `
            <tr><td class="user-link" onclick="navTo('page-profile', '${d.id}')">${d.id}</td><td>Online</td></tr>
        `).join('');
    });
}

/* ================= WITHDRAWALS ================= */
window.withdraw = async (method) => {
    if (user.balance < 1) return alert("Min ₱1.00");
    const info = document.getElementById('payoutInfo').value;
    let amt = user.balance;
    let converted = `₱${amt.toFixed(2)}`;
    if (method === 'FaucetPay') converted = `${(amt / 56).toFixed(4)} USDT`;

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: amt, info: info, method: method,
        converted: converted, status: "Pending", timestamp: Date.now()
    });
    await updateDoc(doc(db, "users", username), { balance: 0 });
    alert("Request Sent!");
};

function syncHist() {
    const q = query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"));
    onSnapshot(q, (s) => {
        const sliced = s.docs.slice((p.hist-1)*10, p.hist*10);
        document.getElementById('histBody').innerHTML = sliced.map(d => `
            <tr><td>${d.data().converted}</td><td>${d.data().method}</td><td class="status-${d.data().status}">${d.data().status}</td></tr>
        `).join('');
    });
}

/* ================= ADMIN ================= */
window.openAdmin = () => {
    if (prompt("Owner Code:") === "Propetas6") { navTo('page-admin'); syncAdmin(); }
};

function syncAdmin() {
    const q = query(collection(db, "withdrawals"), orderBy("status", "desc"), orderBy("timestamp", "desc"));
    onSnapshot(q, (s) => {
        const sliced = s.docs.slice((p.admin-1)*10, p.admin*10);
        document.getElementById('adminBody').innerHTML = sliced.map(d => `
            <tr>
                <td class="user-link" onclick="navTo('page-profile','${d.data().user}')">${d.data().user}</td>
                <td>${d.data().converted}</td><td>${d.data().info}</td>
                <td><button onclick="updStatus('${d.id}','Paid')" style="padding:2px">Pay</button></td>
            </tr>
        `).join('');
    });
}
window.updStatus = async (id, s) => updateDoc(doc(db, "withdrawals", id), { status: s });

/* ================= UTILS ================= */
function showPop(a) { 
    document.getElementById('reward-amt').innerText = `₱${a}`;
    document.getElementById('reward-pop').style.display = 'block'; 
}
window.closeReward = () => document.getElementById('reward-pop').style.display = 'none';

function tick() {
    document.getElementById('footerClock').innerText = new Date().toLocaleTimeString();
    // Cooldown updates logic...
}

function setupTasks() {
    ['signin', 'ads', 'gift', 'bonus'].forEach(key => {
        const cont = document.getElementById(`cont-${key}`);
        cont.innerHTML = `<button onclick="triggerAd('${key}', '${key}_1')">Watch Ad to Earn</button>`;
    });
}

function syncChat() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(15));
    onSnapshot(q, (s) => {
        document.getElementById('chat-box').innerHTML = s.docs.map(d => `<div><b>${d.data().from}:</b> ${d.data().text}</div>`).reverse().join('');
    });
}

window.sendMessage = async () => {
    const i = document.getElementById('chatInput');
    await addDoc(collection(db, "messages"), { from: username, text: i.value, timestamp: serverTimestamp() });
    i.value = "";
};

window.updateUI = () => {
    document.getElementById('topBalance').innerText = user.balance.toFixed(3);
    document.getElementById('earnBox').innerText = user.balance.toFixed(3);
    document.getElementById('userBar').innerText = `👤 ${username}`;
};

init();
