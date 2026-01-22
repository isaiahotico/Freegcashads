
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, increment, collection, addDoc, query, orderBy, limit, serverTimestamp, getDocs, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
tg.expand();

const user = tg.initDataUnsafe?.user || { id: "0000", first_name: "Developer" };
const uid = user.id.toString();

// Navigation
window.toPage = (pg) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav div').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(`p-${pg}`).classList.add('active');
    document.getElementById(`n-${pg}`).classList.add('active-nav');
};

// Admin Password Logic
window.checkPass = () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas6") {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        loadAdminTable();
    } else {
        tg.showAlert("Incorrect Password!");
    }
};

// Initialize User & Real-time Listeners
async function startup() {
    document.getElementById('u-name').innerText = `Hello, ${user.first_name}`;

    // Balance Listener
    onSnapshot(doc(db, "users", uid), (snap) => {
        if (snap.exists()) {
            document.getElementById('u-balance').innerText = `₱ ${snap.data().balance.toFixed(3)}`;
        } else {
            setDoc(doc(db, "users", uid), { balance: 0, name: user.first_name, lastChat: 0 });
        }
    });

    // Chat Listener
    onSnapshot(query(collection(db, "chat"), orderBy("at", "desc"), limit(20)), (snap) => {
        const win = document.getElementById('chat-window');
        win.innerHTML = '';
        snap.docs.reverse().forEach(d => {
            const m = d.data();
            win.innerHTML += `<div class="msg ${m.uid === uid ? 'me' : 'them'}">
                <div style="font-size:9px; opacity:0.6">${m.name}</div>${m.text}</div>`;
        });
        win.scrollTop = win.scrollHeight;
    });

    // Withdrawal History Listener (User)
    onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("at", "desc"), limit(10)), (snap) => {
        const body = document.getElementById('wd-history-body');
        body.innerHTML = '';
        snap.forEach(d => {
            const w = d.data();
            const date = w.at?.toDate().toLocaleDateString() || 'Pending';
            body.innerHTML += `<tr><td>${date}</td><td>₱${w.amount}</td>
                <td><span class="badge ${w.status}">${w.status}</span></td></tr>`;
        });
    });
}

// Adsgram
window.showAd = (blockId) => {
    const ad = window.AdsGram.init({ blockId });
    ad.show().then(() => addMoney(0.02)).catch(() => tg.showAlert("Ad not finished."));
};

// Monetag Chat Logic
window.postChat = async () => {
    const text = document.getElementById('chat-in').value;
    const snap = await (await getDocs(query(collection(db, "users"), where("__name__", "==", uid)))).docs[0];
    const now = Date.now();

    if (!text) return;
    if (now - (snap?.data().lastChat || 0) < 180000) return tg.showAlert("Cooldown: 3 mins!");

    tg.showConfirm("Watch 3 Ads to send?", async (ok) => {
        if (!ok) return;
        try {
            tg.MainButton.setText("Loading Ads...").show();
            await show_10337853(); await show_10337795(); await show_10276123();
            await addDoc(collection(db, "chat"), { uid, name: user.first_name, text, at: serverTimestamp() });
            await updateDoc(doc(db, "users", uid), { balance: increment(0.015), lastChat: now });
            document.getElementById('chat-in').value = '';
        } catch (e) { tg.showAlert("Ads failed!"); }
        finally { tg.MainButton.hide(); }
    });
};

// Withdrawal Request
window.reqWithdraw = async () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const gcash = document.getElementById('wd-phone').value;
    const snap = await (await getDocs(query(collection(db, "users"), where("__name__", "==", uid)))).docs[0];

    if (amt < 0.02 || amt > snap.data().balance) return tg.showAlert("Invalid Balance/Amount");
    if (!gcash) return tg.showAlert("Enter GCash number");

    await addDoc(collection(db, "withdrawals"), {
        uid, name: user.first_name, amount: amt, gcash, status: "pending", at: serverTimestamp()
    });
    await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
    tg.showAlert("Request Sent!");
};

// Admin Panel Logic
function loadAdminTable() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending"), orderBy("at", "asc")), (snap) => {
        const body = document.getElementById('admin-table-body');
        body.innerHTML = '';
        snap.forEach(d => {
            const w = d.data();
            body.innerHTML += `<tr><td>${w.name}</td><td>₱${w.amount}</td><td>${w.gcash}</td>
                <td>
                    <button class="btn" style="padding:5px; background:green; margin-bottom:5px" onclick="actWD('${d.id}', 'approved')">✔</button>
                    <button class="btn" style="padding:5px; background:red" onclick="actWD('${d.id}', 'rejected', ${w.amount}, '${w.uid}')">✖</button>
                </td></tr>`;
        });
    });
}

window.actWD = async (id, status, refund = 0, targetUid = '') => {
    await updateDoc(doc(db, "withdrawals", id), { status });
    if (status === 'rejected') {
        await updateDoc(doc(db, "users", targetUid), { balance: increment(refund) });
    }
    tg.HapticFeedback.notificationOccurred('success');
};

async function addMoney(val) {
    await updateDoc(doc(db, "users", uid), { balance: increment(val) });
    tg.HapticFeedback.impactOccurred('medium');
}

startup();
