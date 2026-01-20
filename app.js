
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
const tgUser = tg?.initDataUnsafe?.user;
const myUsername = tgUser ? (tgUser.username || tgUser.first_name) : "Guest_" + Math.floor(1000 + Math.random() * 9000);

let myData = { balance: 0, role: 'user' };
let adminPage = 1;
const ADMIN_PAGE_SIZE = 25;

/* ================= ADMIN SEAT & GATE ================= */
window.checkAdminSeat = async () => {
    if (myData.role === 'admin') {
        navTo('page-admin');
        return;
    }
    const snap = await getDoc(doc(db, "stats", "admin_config"));
    const seats = snap.exists() ? snap.data().count : 0;
    document.getElementById('admin-seats').innerText = `${seats}/2 Seats Taken`;
    document.getElementById('admin-gate').classList.remove('hidden');
};

window.verifyAdmin = async () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        const statsRef = doc(db, "stats", "admin_config");
        const snap = await getDoc(statsRef);
        const count = snap.exists() ? snap.data().count : 0;

        if (count < 2) {
            await setDoc(statsRef, { count: increment(1) }, { merge: true });
            await updateDoc(doc(db, "users", myUsername), { role: 'admin' });
            alert("Success! Dashboard Unlocked.");
            location.reload();
        } else {
            alert("Admin slots are completely full.");
        }
    } else {
        alert("Incorrect Access Code.");
    }
};

window.closeAdminGate = () => document.getElementById('admin-gate').classList.add('hidden');

/* ================= ADMIN REAL-TIME DASHBOARD (25 per page) ================= */
function loadAdminDashboard() {
    onSnapshot(query(collection(db, "withdrawals"), orderBy("timestamp", "desc")), (snap) => {
        const list = snap.docs;
        const start = (adminPage - 1) * ADMIN_PAGE_SIZE;
        const end = start + ADMIN_PAGE_SIZE;
        const pagedList = list.slice(start, end);

        const body = document.getElementById('admin-live-body');
        body.innerHTML = pagedList.map(d => {
            const row = d.data();
            return `
                <tr>
                    <td>${row.username}</td>
                    <td>GCash</td>
                    <td>₱${row.amount.toFixed(2)}</td>
                    <td><span class="status-pill status-${row.status}">${row.status}</span></td>
                    <td>
                        ${row.status === 'Pending' ? 
                        `<button onclick="approveWithdrawal('${d.id}')" style="background:#27ae60; border:none; color:white; padding:4px 8px; border-radius:4px;">Approve</button>` 
                        : 'COMPLETED'}
                    </td>
                </tr>
            `;
        }).join('');
        document.getElementById('current-admin-page').innerText = adminPage;
    });
}

window.approveWithdrawal = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: 'Approved' });
};

window.nextAdminPage = () => { adminPage++; loadAdminDashboard(); };
window.prevAdminPage = () => { if(adminPage > 1) { adminPage--; loadAdminDashboard(); } };

/* ================= WITHDRAWAL SYSTEM ================= */
window.handleWithdraw = async () => {
    const info = document.getElementById('pay-info').value;
    if (myData.balance < 0.02) return alert("Min: ₱0.02");
    if (!info) return alert("Enter account details.");

    await addDoc(collection(db, "withdrawals"), {
        username: myUsername,
        amount: myData.balance,
        status: 'Pending',
        timestamp: serverTimestamp()
    });
    await updateDoc(doc(db, "users", myUsername), { balance: 0 });
    alert("Request Live!");
};

/* ================= CORE SYNC ================= */
async function init() {
    const uRef = doc(db, "users", myUsername);
    const snap = await getDoc(uRef);
    if (!snap.exists()) await setDoc(uRef, { username: myUsername, balance: 0, role: 'user' });

    onSnapshot(uRef, (d) => {
        myData = d.data();
        document.getElementById('user-display').innerText = "@" + myUsername;
        document.getElementById('bal-display').innerText = myData.balance.toFixed(3);
        if (myData.role === 'admin') loadAdminDashboard();
    });

    // Presence Logic
    setInterval(() => setDoc(doc(db, "online", myUsername), { ts: serverTimestamp() }), 30000);
    onSnapshot(collection(db, "online"), (s) => {
        document.getElementById('count-online').innerText = s.size;
        document.getElementById('online-list').innerHTML = s.docs.map(d => d.id).join(', ');
    });

    // User History Sync
    onSnapshot(query(collection(db, "withdrawals"), where("username", "==", myUsername)), (s) => {
        document.getElementById('user-history-body').innerHTML = s.docs.map(d => `
            <tr><td>User Hist</td><td>₱${d.data().amount.toFixed(2)}</td><td>${d.data().status}</td></tr>
        `).join('');
    });
}

window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

init();
setInterval(() => { document.getElementById('clock').innerText = new Date().toLocaleTimeString(); }, 1000);
