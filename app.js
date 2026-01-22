
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, push, get, query, orderByChild, limitToLast, limitToFirst, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user || { id: "0000", first_name: "LocalUser", username: "User" };
const uid = user.id.toString();
const uName = user.username || user.first_name;

// --- INITIALIZE USER ---
const userRef = ref(db, 'users/' + uid);
onValue(userRef, (snap) => {
    if (!snap.exists()) {
        const refBy = tg.initDataUnsafe?.start_param || null;
        set(userRef, { uid, username: uName, balance: 0, referrals: 0, referredBy: refBy, lastAd: 0 });
    } else {
        document.getElementById('balance').innerText = snap.val().balance.toFixed(3);
        document.getElementById('display-username').innerText = snap.val().username;
    }
});

document.getElementById('ref-link').value = `https://t.me/paperhouseinc_bot/start?startapp=${uid}`;

// --- AD REWARD LOGIC (COMBINED 3) ---
window.runAdFlow = async (type) => {
    const snap = await get(userRef);
    const last = snap.val().lastAd || 0;
    if (Date.now() - last < 180000) return tg.showAlert("Cooldown active! Wait 3 minutes.");

    tg.showConfirm("Watch 3 Ads to get ₱0.015?", async (ok) => {
        if (!ok) return;
        
        try {
            for (let i = 1; i <= 3; i++) {
                tg.showAlert(`Starting Ad ${i} of 3...`);
                await new Promise((resolve) => {
                    const adFunc = type === 'reward' ? show_10276123 : () => show_10276123('pop');
                    adFunc().then(() => resolve()).catch(() => resolve());
                });
            }
            // Reward after 3
            addBalance(0.015);
            update(userRef, { lastAd: Date.now() });
            tg.showAlert("🎖 Task Complete! ₱0.015 added to your balance.");
        } catch (e) {
            tg.showAlert("Ad error. Please try again.");
        }
    });
};

async function addBalance(amount) {
    const snap = await get(userRef);
    const newBal = (snap.val().balance || 0) + amount;
    await update(userRef, { balance: newBal });

    // Referral 10%
    if (snap.val().referredBy) {
        const rRef = ref(db, 'users/' + snap.val().referredBy);
        const rSnap = await get(rRef);
        if (rSnap.exists()) {
            update(rRef, { balance: rSnap.val().balance + (amount * 0.1) });
        }
    }
}

// --- CHAT SYSTEM ---
window.sendMessage = () => {
    const text = document.getElementById('chat-input').value;
    if (!text) return;
    push(ref(db, 'messages'), {
        username: uName,
        text: text,
        timestamp: serverTimestamp()
    });
    document.getElementById('chat-input').value = "";
};

const chatRef = query(ref(db, 'messages'), limitToLast(20));
onChildAdded(chatRef, (data) => {
    const msg = data.val();
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = `<b>${msg.username}</b> ${msg.text}`;
    const container = document.getElementById('chat-messages');
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
});

// --- LEADERBOARD (PAGINATED LIVE) ---
function loadLeaderboard() {
    const lbQuery = query(ref(db, 'users'), orderByChild('balance'), limitToLast(20));
    onValue(lbQuery, (snap) => {
        let html = "";
        let players = [];
        snap.forEach(child => players.push(child.val()));
        players.reverse().forEach((p, i) => {
            html += `<div class="list-item"><span>${i + 1}. ${p.username}</span> <b>₱${p.balance.toFixed(3)}</b></div>`;
        });
        document.getElementById('leaderboard-list').innerHTML = html;
    });
}

// --- WITHDRAWAL ---
window.submitWithdraw = async () => {
    const amount = parseFloat(document.getElementById('w-amount').value);
    const gcash = document.getElementById('w-gcash').value;
    const snap = await get(userRef);
    if (amount < 0.02) return tg.showAlert("Min withdrawal ₱0.02");
    if (amount > snap.val().balance) return tg.showAlert("Insufficient balance!");

    await update(userRef, { balance: snap.val().balance - amount });
    push(ref(db, 'withdrawals'), { uid, username: uName, amount, gcash, status: 'pending' });
    tg.showAlert("Request Sent!");
};

// --- ADMIN ---
window.loginAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').style.display = "none";
        document.getElementById('admin-panel').style.display = "block";
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        let html = "";
        snap.forEach(child => {
            const w = child.val();
            if (w.status === 'pending') {
                html += `<div class="list-item">
                    <span>${w.username}: ₱${w.amount}<br>${w.gcash}</span>
                    <button onclick="approve('${child.key}')">Pay</button>
                </div>`;
            }
        });
        document.getElementById('admin-requests').innerHTML = html;
    });
}
window.approve = (key) => update(ref(db, `withdrawals/${key}`), { status: 'paid' });

// --- UI TABS ---
window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active-tab');
    event.currentTarget.classList.add('active');
    if (id === 'leaderboard') loadLeaderboard();
};
