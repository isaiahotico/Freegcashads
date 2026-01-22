
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, startAfter, startAt, endBefore, getDocs, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const tg = window.Telegram.WebApp;
tg.ready();

const OWNER_ID = "YOUR_TELEGRAM_ID_HERE"; // <--- CHANGE THIS
const user = tg.initDataUnsafe?.user || { id: 12345, first_name: "TestUser" };
const uid = user.id.toString();

// Pagination State
let userWDCursor = null;
let adminCursor = null;
const PAGE_SIZE = 5;

// Navigation
window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav div').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(`page-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active-nav');
    if(id === 'wallet') loadUserWithdrawals();
    if(id === 'admin') loadAdminWithdrawals();
};

// Initial Setup
async function initApp() {
    if (uid === OWNER_ID) document.getElementById('nav-admin').style.display = 'block';
    document.getElementById('username-display').innerText = user.first_name;

    // Real-time Balance
    onSnapshot(doc(db, "users", uid), (snap) => {
        if (snap.exists()) {
            document.getElementById('balance-display').innerText = `₱ ${snap.data().balance.toFixed(3)}`;
        } else {
            setDoc(doc(db, "users", uid), { balance: 0, lastChat: 0, name: user.first_name });
        }
    });

    // Real-time Chat
    const qChat = query(collection(db, "chat"), orderBy("at", "desc"), limit(20));
    onSnapshot(qChat, (snap) => {
        const area = document.getElementById('chat-area');
        area.innerHTML = '';
        snap.docs.reverse().forEach(d => {
            const m = d.data();
            area.innerHTML += `<div class="bubble ${m.uid === uid ? 'me' : 'them'}">
                <small style="display:block; font-size:9px;">${m.name}</small>${m.text}</div>`;
        });
        area.scrollTop = area.scrollHeight;
    });
}

// Adsgram logic
window.triggerAd = (blockId) => {
    const ad = window.AdsGram.init({ blockId });
    ad.show().then(() => updateBalance(0.02)).catch(() => tg.showAlert("Ad skipped."));
};

// Monetag + Chat logic
window.sendChatMsg = async () => {
    const text = document.getElementById('msg-input').value;
    const snap = await getDoc(doc(db, "users", uid));
    const now = Date.now();

    if (!text) return;
    if (now - (snap.data().lastChat || 0) < 180000) return tg.showAlert("Wait 3 mins cooldown.");

    tg.showConfirm("Watch 3 Ads to chat and earn ₱0.015?", async (ok) => {
        if (!ok) return;
        try {
            tg.MainButton.setText("Watching Ad 1...").show();
            await show_10337853();
            tg.MainButton.setText("Watching Ad 2...");
            await show_10337795();
            tg.MainButton.setText("Watching Ad 3...");
            await show_10276123();
            
            await addDoc(collection(db, "chat"), { uid, name: user.first_name, text, at: serverTimestamp() });
            await updateDoc(doc(db, "users", uid), { balance: increment(0.015), lastChat: now });
            document.getElementById('msg-input').value = '';
        } catch (e) { tg.showAlert("Ad failed."); }
        finally { tg.MainButton.hide(); }
    });
};

// --- Withdrawal Logic ---

window.submitWithdrawal = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const gcash = document.getElementById('wd-gcash').value;
    const snap = await getDoc(doc(db, "users", uid));

    if (amt < 0.02 || amt > snap.data().balance) return tg.showAlert("Check balance/min amount.");
    if (!gcash) return tg.showAlert("Enter GCash number.");

    await addDoc(collection(db, "withdrawals"), {
        uid, name: user.first_name, amount: amt, gcash, status: "pending", at: serverTimestamp()
    });
    await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
    tg.showAlert("Requested!");
    loadUserWithdrawals();
};

// User Pagination
async function loadUserWithdrawals(direction = 'next') {
    let q = query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("at", "desc"), limit(PAGE_SIZE));
    
    if (direction === 'next' && userWDCursor) q = query(q, startAfter(userWDCursor));

    const snap = await getDocs(q);
    if (snap.empty) return;
    userWDCursor = snap.docs[snap.docs.length - 1];

    const body = document.getElementById('user-wd-body');
    body.innerHTML = '';
    snap.forEach(d => {
        const w = d.data();
        body.innerHTML += `<tr><td>${w.at?.toDate().toLocaleDateString() || '...'}</td>
            <td>₱${w.amount}</td><td class="status-${w.status}">${w.status}</td></tr>`;
    });
}
window.paginateUserWD = (dir) => loadUserWithdrawals(dir);

// Admin Pagination & Real-time approval
async function loadAdminWithdrawals(direction = 'next') {
    let q = query(collection(db, "withdrawals"), where("status", "==", "pending"), orderBy("at", "asc"), limit(PAGE_SIZE));
    if (direction === 'next' && adminCursor) q = query(q, startAfter(adminCursor));

    const snap = await getDocs(q);
    const body = document.getElementById('admin-wd-body');
    body.innerHTML = '';
    
    if (snap.empty) { body.innerHTML = '<tr><td colspan="4">No pending requests</td></tr>'; return; }
    adminCursor = snap.docs[snap.docs.length - 1];

    snap.forEach(d => {
        const w = d.data();
        body.innerHTML += `<tr><td>${w.name}</td><td>₱${w.amount}</td><td>${w.gcash}</td>
            <td>
                <button class="btn btn-small" onclick="processWD('${d.id}', 'approved')">✔</button>
                <button class="btn btn-small btn-danger" onclick="processWD('${d.id}', 'rejected', ${w.amount}, '${w.uid}')">✖</button>
            </td></tr>`;
    });
}
window.paginateAdmin = (dir) => loadAdminWithdrawals(dir);

window.processWD = async (id, status, refund = 0, targetUid = '') => {
    await updateDoc(doc(db, "withdrawals", id), { status });
    if (status === 'rejected') {
        await updateDoc(doc(db, "users", targetUid), { balance: increment(refund) });
    }
    tg.showAlert(`Request ${status}`);
    loadAdminWithdrawals();
};

async function updateBalance(amt) {
    await updateDoc(doc(db, "users", uid), { balance: increment(amt) });
    tg.HapticFeedback.notificationOccurred('success');
}

initApp();
