
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc, increment, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user;
const myUsername = user ? (user.username || user.first_name) : "Guest_" + Math.floor(Math.random()*9999);
let myData = { balance: 0, role: 'user' };
let currentRoom = 'elementary';
let adminPage = 1;

/* ================= FAST ADMIN VERIFICATION ================= */
window.openAdminGate = async () => {
    if (myData.role === 'admin') return navTo('page-admin');
    document.getElementById('admin-gate').classList.remove('hidden');
};

window.verifyAdminFast = async () => {
    const code = document.getElementById('admin-input').value;
    if (code === "Propetas12") {
        const statsRef = doc(db, "stats", "admin_config");
        const snap = await getDoc(statsRef);
        const count = snap.exists() ? snap.data().count : 0;
        if (count < 2) {
            await setDoc(statsRef, { count: increment(1) }, { merge: true });
            await updateDoc(doc(db, "users", myUsername), { role: 'admin' });
            alert("Admin Seat Secured!");
            navTo('page-admin');
            document.getElementById('admin-gate').classList.add('hidden');
        } else { alert("Seats Full!"); }
    } else { alert("Invalid Code"); }
};

/* ================= ADMIN COMMANDER (25/page) ================= */
function syncAdminDashboard() {
    onSnapshot(query(collection(db, "withdrawals"), orderBy("timestamp", "desc")), (snap) => {
        const docs = snap.docs;
        const body = document.getElementById('admin-table-body');
        const start = (adminPage - 1) * 25;
        const paged = docs.slice(start, start + 25);
        
        body.innerHTML = paged.map(d => {
            const row = d.data();
            return `<tr>
                <td>${row.username}</td>
                <td>₱${row.amount.toFixed(2)}</td>
                <td style="color:${row.status === 'Approved' ? '#2ecc71' : '#f1c40f'}">${row.status}</td>
                <td>${row.status === 'Pending' ? `<button onclick="approveWD('${d.id}')">Approve</button>` : '✓'}</td>
            </tr>`;
        }).join('');
        document.getElementById('admin-page-num').innerText = adminPage;
    });
}
window.approveWD = async (id) => await updateDoc(doc(db, "withdrawals", id), { status: 'Approved' });
window.changeAdminPage = (val) => { adminPage = Math.max(1, adminPage + val); syncAdminDashboard(); };

/* ================= CHAT & EARN ================= */
window.openRoom = (room) => {
    currentRoom = room;
    document.getElementById('chat-title').innerText = room.toUpperCase() + " ROOM";
    navTo('page-chat');
    onSnapshot(query(collection(db, "messages"), where("room", "==", room), orderBy("timestamp", "desc"), limit(40)), (snap) => {
        document.getElementById('chat-box').innerHTML = snap.docs.reverse().map(d => `<div><b>${d.data().user}:</b> ${d.data().text}</div>`).join('');
        document.getElementById('chat-box').scrollTop = 99999;
    });
};

window.sendMessage = async () => {
    const txt = document.getElementById('chat-msg').value;
    if (!txt) return;
    try {
        await show_10337853();
        await addDoc(collection(db, "messages"), { user: "@"+myUsername, text: txt, room: currentRoom, timestamp: serverTimestamp() });
        await updateDoc(doc(db, "users", myUsername), { balance: increment(0.015) });
        document.getElementById('chat-msg').value = "";
    } catch (e) { alert("Ad Required"); }
};

/* ================= REFERRALS ================= */
window.bindReferral = async () => {
    const friend = document.getElementById('ref-input').value.trim();
    if (friend === myUsername) return alert("Invalid");
    await updateDoc(doc(db, "users", myUsername), { referredBy: friend });
    alert("Linked to " + friend);
};

window.claimReferralBonus = async () => {
    const bonus = myData.refBonus || 0;
    await updateDoc(doc(db, "users", myUsername), { balance: increment(bonus), refBonus: 0 });
    alert("Bonus Claimed!");
};

/* ================= GIFT ADS ================= */
window.watchGiftAds = async () => {
    const now = Date.now();
    if (now - (myData.lastGift || 0) < 300000) return alert("Cooldown Active");
    try {
        await show_10276123(); await show_10337795(); await show_10337853();
        const bonus = 0.015;
        await updateDoc(doc(db, "users", myUsername), { balance: increment(bonus), lastGift: now });
        if (myData.referredBy) await updateDoc(doc(db, "users", myData.referredBy), { refBonus: increment(bonus * 0.1) });
        showGreeting();
    } catch (e) { alert("Ads incomplete"); }
};

/* ================= CORE INIT ================= */
async function init() {
    document.getElementById('live-user').innerText = "@" + myUsername;
    document.getElementById('ref-code-display').innerText = myUsername;

    const uRef = doc(db, "users", myUsername);
    const snap = await getDoc(uRef);
    if (!snap.exists()) await setDoc(uRef, { username: myUsername, balance: 0, role: 'user', refBonus: 0 });

    onSnapshot(uRef, (d) => {
        myData = d.data();
        document.getElementById('live-bal').innerText = myData.balance.toFixed(3);
        document.getElementById('ref-bonus-val').innerText = (myData.refBonus || 0).toFixed(3);
        if (myData.role === 'admin') syncAdminDashboard();
    });

    // Withdrawal Sync
    onSnapshot(query(collection(db, "withdrawals"), where("username", "==", myUsername)), (s) => {
        document.getElementById('wd-body').innerHTML = s.docs.map(d => `<tr><td>₱${d.data().amount.toFixed(2)}</td><td>${d.data().status}</td><td>${d.data().timestamp?.toDate().toLocaleTimeString() || '...'}</td></tr>`).join('');
    });

    // Online Status
    setInterval(() => setDoc(doc(db, "online", myUsername), { ts: serverTimestamp() }), 20000);
    onSnapshot(collection(db, "online"), (s) => {
        document.getElementById('online-total').innerText = s.size;
        document.getElementById('online-list').innerHTML = s.docs.map(d => d.id).join(', ');
    });
}

window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
function showGreeting() {
    const msgs = ["STUNNING!", "APEX EARNER!", "SUPREME!"];
    document.getElementById('greet-title').innerText = msgs[Math.floor(Math.random()*3)];
    document.getElementById('greet-modal').classList.remove('hidden');
}

init();
