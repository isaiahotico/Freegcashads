
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

/* ================= TG CORE ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const username = tg?.initDataUnsafe?.user?.username ? `@${tg.initDataUnsafe.user.username}` : "Guest_" + Math.floor(Math.random()*9999);
const startParam = tg?.initDataUnsafe?.start_param;

let user = {};
let p = { leader: 1, hist: 1, admin: 1, online: 1 };
let viewingProfile = null;

/* ================= INITIALIZE ================= */
async function init() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        const refBy = (startParam && `@${startParam}` !== username) ? `@${startParam}` : null;
        await setDoc(userRef, { 
            balance: 0, ads_day: 0, ads_week: 0, ads_total: 0, 
            lastD: Date.now(), lastW: Date.now(), weekly_points: 0,
            referredBy: refBy, refClaimable: 0, lastActive: Date.now() 
        });
        if(refBy) await updateDoc(doc(db, "users", refBy), { invites: increment(1) }).catch(()=>{});
    }

    onSnapshot(userRef, (s) => {
        user = s.data();
        checkResets(userRef);
        updateUI();
    });

    setInterval(() => updateDoc(userRef, { lastActive: Date.now() }), 30000);
    setupTasks();
    syncChat();
    syncOnline();
    setInterval(updateTimers, 1000);
}

/* ================= TASK ENGINE ================= */
function setupTasks() {
    const sets = {
        signin: { r: 0.02, c: 86400000, n: 1, z: 10276123 },
        ads: { r: 0.02, c: 300000, n: 5, z: 10337853 },
        gift: { r: 0.02, c: 7200000, n: 3, z: 10337795 },
        bonus: { r: 0.015, c: 600000, n: 5, z: 10276123 }
    };
    Object.keys(sets).forEach(key => {
        const conf = sets[key];
        const cont = document.getElementById(`area-${key}`);
        cont.innerHTML = `<h3>🍍 ${key.toUpperCase()}</h3>`;
        for (let i = 1; i <= conf.n; i++) {
            const id = `${key}_${i}`;
            cont.innerHTML += `
                <div class="card">
                    <button class="rainbow-btn" id="btn-${id}" onclick="runAd('${key}','${id}')">CLAIM ₱${conf.r} #${i}</button>
                    <div id="tmr-${id}" style="font-size:10px; color:red;"></div>
                </div>`;
        }
    });
}

window.runAd = (key, id) => {
    const rewards = { signin: 0.02, ads: 0.02, gift: 0.02, bonus: 0.015 };
    const cds = { signin: 86400000, ads: 300000, gift: 7200000, bonus: 600000 };
    const z = key === 'ads' ? 10337853 : (key === 'gift' ? 10337795 : 10276123);

    window[`show_${z}`]().then(async () => {
        const r = rewards[key];
        const uRef = doc(db, "users", username);
        await updateDoc(uRef, {
            balance: increment(r), ads_day: increment(1), ads_week: increment(1),
            ads_total: increment(1), weekly_points: increment(r),
            [`cooldowns.${id}`]: Date.now() + cds[key]
        });
        if (user.referredBy) {
            await updateDoc(doc(db, "users", user.referredBy), { refClaimable: increment(r * 0.1) });
        }
        showPop(r);
    }).catch(() => alert("Ad failed to load. Try turning off VPN/Adblock."));
};

/* ================= WITHDRAWALS ================= */
window.requestPayout = async (method) => {
    if (user.balance < 1) return alert("Min. ₱1.00");
    const info = document.getElementById('drawInfo').value;
    if (!info) return alert("Enter details!");

    let conv = `₱${user.balance.toFixed(2)}`;
    if (method === 'FaucetPay') conv = `${(user.balance / 56).toFixed(4)} USDT`;

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: user.balance, method: method,
        info: info, converted: conv, status: "Pending", timestamp: Date.now()
    });
    await updateDoc(doc(db, "users", username), { balance: 0 });
    alert("Withdrawal submitted!");
};

function syncHist() {
    const q = query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"));
    onSnapshot(q, (s) => {
        const data = s.docs.map(d => d.data());
        const slice = data.slice((p.hist-1)*10, p.hist*10);
        document.getElementById('histBody').innerHTML = slice.map(r => `
            <tr><td>${new Date(r.timestamp).toLocaleDateString()}</td><td>${r.method}</td><td>${r.converted}</td><td class="status-${r.status}">${r.status}</td></tr>
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
        const data = s.docs.map(d => ({id: d.id, ...d.data()}));
        const slice = data.slice((p.admin-1)*10, p.admin*10);
        document.getElementById('adminBody').innerHTML = slice.map(r => `
            <tr>
                <td class="user-tag" onclick="navTo('page-profile', '${r.user}')">${r.user}</td>
                <td>${r.method}</td><td>${r.info}</td><td>${r.converted}</td>
                <td>
                    ${r.status === 'Pending' ? `<button onclick="updStatus('${r.id}', 'Paid')">Pay</button>` : r.status}
                </td>
            </tr>
        `).join('');
    });
}
window.updStatus = async (id, stat) => await updateDoc(doc(db, "withdrawals", id), { status: stat });

/* ================= PROFILE & ONLINE ================= */
async function loadProfile(uid) {
    viewingProfile = uid;
    const snap = await getDoc(doc(db, "users", uid));
    const d = snap.data();
    document.getElementById('prof-user').innerText = uid;
    document.getElementById('ads-day').innerText = d.ads_day || 0;
    document.getElementById('ads-week').innerText = d.ads_week || 0;
    document.getElementById('ads-total').innerText = d.ads_total || 0;
    document.getElementById('msg-icon').classList.toggle('hidden', uid === username);
}

function syncOnline() {
    const q = query(collection(db, "users"), where("lastActive", ">", Date.now() - 60000));
    onSnapshot(q, (s) => {
        document.getElementById('onlineBody').innerHTML = s.docs.map(d => `
            <tr><td class="user-tag" onclick="navTo('page-profile', '${d.id}')">${d.id}</td><td>✅ Online</td></tr>
        `).join('');
    });
}

/* ================= UTILS ================= */
window.navTo = (id, uid = null) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'page-profile') loadProfile(uid || username);
    if (id === 'page-withdraw') syncHist();
    if (id === 'page-leader') syncLeaders();
};

window.linkReferrer = async () => {
    const code = document.getElementById('refCodeInput').value.trim();
    if (!code.startsWith('@') || code === username) return alert("Invalid Code");
    const ref = await getDoc(doc(db, "users", code));
    if (ref.exists()) {
        await updateDoc(doc(db, "users", username), { referredBy: code });
        alert("Referrer Linked!");
    } else alert("User not found!");
};

window.claimReferral = async () => {
    if (user.refClaimable <= 0) return alert("No bonus yet.");
    const amt = user.refClaimable;
    await updateDoc(doc(db, "users", username), { balance: increment(amt), refClaimable: 0 });
    alert(`Claimed ₱${amt.toFixed(3)}!`);
};

function syncLeaders() {
    const q = query(collection(db, "users"), orderBy("weekly_points", "desc"), limit(50));
    onSnapshot(q, (s) => {
        const data = s.docs.map(d => ({id: d.id, pts: d.data().weekly_points}));
        const slice = data.slice((p.leader-1)*10, p.leader*10);
        document.getElementById('leaderBody').innerHTML = slice.map((r, i) => `
            <tr><td>#${((p.leader-1)*10)+i+1}</td><td class="user-tag" onclick="navTo('page-profile', '${r.id}')">${r.id}</td><td>₱${r.pts.toFixed(2)}</td></tr>
        `).join('');
    });
}

function syncChat() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(20));
    onSnapshot(q, (s) => {
        document.getElementById('chatBox').innerHTML = s.docs.map(d => `<div><b>${d.data().user}:</b> ${d.data().text}</div>`).reverse().join('');
    });
}

window.sendMsg = async () => {
    const inp = document.getElementById('chatInput');
    if (!inp.value.trim()) return;
    await addDoc(collection(db, "messages"), { user: username, text: inp.value, timestamp: serverTimestamp() });
    inp.value = "";
};

window.changeP = (key, dir) => {
    p[key] = Math.max(1, p[key] + dir);
    document.getElementById(`${key}Page`).innerText = p[key];
    if (key === 'admin') syncAdmin();
    if (key === 'hist') syncHist();
    if (key === 'leader') syncLeaders();
};

function checkResets(ref) {
    const now = Date.now();
    if (now - user.lastD > 86400000) updateDoc(ref, { ads_day: 0, lastD: now });
    if (now - user.lastW > 604800000) updateDoc(ref, { ads_week: 0, weekly_points: 0, lastW: now });
}

function updateTimers() {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString();
    Object.keys(user.cooldowns || {}).forEach(id => {
        const btn = document.getElementById(`btn-${id}`), tmr = document.getElementById(`tmr-${id}`), target = user.cooldowns[id];
        if (btn && Date.now() < target) {
            btn.disabled = true;
            const diff = target - Date.now();
            tmr.innerText = `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m ${Math.floor((diff%60000)/1000)}s`;
        } else if (btn) { btn.disabled = false; tmr.innerText = ""; }
    });
}

function showPop(val) {
    document.getElementById('reward-val').innerText = `₱${val}`;
    document.getElementById('reward-pop').style.display = 'block';
}

window.tgOpen = (url) => tg.openLink(url);
window.updateUI = () => {
    document.getElementById('topBalance').innerText = user.balance.toFixed(3);
    document.getElementById('drawBalance').innerText = user.balance.toFixed(3);
    document.getElementById('userBar').innerText = `👤 ${username}`;
    document.getElementById('refBonusAmt').innerText = (user.refClaimable || 0).toFixed(3);
};

init();
