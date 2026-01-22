
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, push, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

const user = tg.initDataUnsafe?.user || { id: "12345", first_name: "Guest", username: "GuestUser" };
const userId = user.id;
const username = user.username || user.first_name;

// --- INITIALIZATION ---
document.getElementById('display-username').innerText = "@" + username;
document.getElementById('ref-link').value = `https://t.me/paperhouseinc_bot/start?startapp=${userId}`;

// Listen for Data
const userRef = ref(db, 'users/' + userId);
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        document.getElementById('balance').innerText = (data.balance || 0).toFixed(4);
        document.getElementById('ref-count').innerText = data.referrals || 0;
        checkCooldowns(data.lastAdTime, data.lastPopTime);
    } else {
        // New User Registration
        const referrerId = tg.initDataUnsafe?.start_param || null;
        set(userRef, {
            username: username,
            balance: 0,
            referrals: 0,
            referredBy: referrerId,
            lastAdTime: 0,
            lastPopTime: 0
        });
        if(referrerId) handleReferral(referrerId);
    }
});

async function handleReferral(refId) {
    const rRef = ref(db, 'users/' + refId);
    const snap = await get(rRef);
    if(snap.exists()){
        update(rRef, { referrals: (snap.val().referrals || 0) + 1 });
    }
}

// --- AD LOGIC (3 COMBINED) ---
window.startAdSequence = async function(type) {
    const btn = type === 'reward' ? document.getElementById('btn-ads') : document.getElementById('btn-pop');
    btn.disabled = true;
    
    try {
        tg.showConfirm(`You need to view 3 ads to get the reward. Start?`, async (ok) => {
            if(!ok) { btn.disabled = false; return; }
            
            for(let i = 1; i <= 3; i++) {
                tg.showScanQrPopup({ text: `Watching Ad ${i} of 3...` }); 
                setTimeout(() => tg.closeScanQrPopup(), 2000);

                if(type === 'reward') {
                    await show_10276123();
                } else {
                    await show_10276123('pop');
                }
            }
            
            completeSequence(type);
        });
    } catch (e) {
        alert("Ad failed to load. Check internet.");
        btn.disabled = false;
    }
};

async function completeSequence(type) {
    const snap = await get(userRef);
    const data = snap.val();
    const reward = 0.015;
    const now = Date.now();

    let updates = { balance: (data.balance || 0) + reward };
    if(type === 'reward') updates.lastAdTime = now;
    else updates.lastPopTime = now;

    await update(userRef, updates);
    
    // Referral Commission (10%)
    if(data.referredBy) {
        const refUserRef = ref(db, 'users/' + data.referredBy);
        const rSnap = await get(refUserRef);
        if(rSnap.exists()) {
            update(refUserRef, { balance: (rSnap.val().balance || 0) + (reward * 0.1) });
        }
    }

    tg.showAlert(`Success! You earned ₱${reward}`);
}

function checkCooldowns(lastAd, lastPop) {
    const now = Date.now();
    const wait = 3 * 60 * 1000;

    const adDiff = now - (lastAd || 0);
    if(adDiff < wait) {
        document.getElementById('btn-ads').disabled = true;
        document.getElementById('cooldown-ads').innerText = `Wait ${Math.ceil((wait - adDiff)/1000)}s`;
    } else {
        document.getElementById('btn-ads').disabled = false;
        document.getElementById('cooldown-ads').innerText = "";
    }

    const popDiff = now - (lastPop || 0);
    if(popDiff < wait) {
        document.getElementById('btn-pop').disabled = true;
        document.getElementById('cooldown-pop').innerText = `Wait ${Math.ceil((wait - popDiff)/1000)}s`;
    } else {
        document.getElementById('btn-pop').disabled = false;
        document.getElementById('cooldown-pop').innerText = "";
    }
}

// --- WITHDRAWAL ---
window.requestWithdrawal = async function() {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const gcash = document.getElementById('gcash-num').value;
    const snap = await get(userRef);
    const balance = snap.val().balance || 0;

    if(amount < 50) return tg.showAlert("Min ₱50");
    if(amount > balance) return tg.showAlert("Insufficient balance");
    if(gcash.length < 10) return tg.showAlert("Invalid GCash number");

    await update(userRef, { balance: balance - amount });
    await push(ref(db, 'withdrawals'), {
        uid: userId,
        username: username,
        amount: amount,
        method: 'GCash',
        number: gcash,
        status: 'pending',
        time: Date.now()
    });
    tg.showAlert("Withdrawal Requested!");
};

// --- LEADERBOARD ---
function loadLeaderboard() {
    const topQuery = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    onValue(topQuery, (snap) => {
        let html = "";
        const items = [];
        snap.forEach(child => { items.push(child.val()); });
        items.reverse().forEach((u, i) => {
            html += `<div class="list-item"><span>${i+1}. ${u.username}</span> <b>₱${u.balance.toFixed(2)}</b></div>`;
        });
        document.getElementById('leaderboard-list').innerHTML = html;
    });
}

// --- ADMIN ---
window.checkAdmin = function() {
    const pass = document.getElementById('admin-pass').value;
    if(pass === "Propetas12") {
        document.getElementById('admin-login').style.display = "none";
        document.getElementById('admin-content').style.display = "block";
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
};

function loadAdminData() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        let html = "";
        snap.forEach(child => {
            const w = child.val();
            if(w.status === 'pending') {
                html += `<div class="list-item" style="font-size:0.8rem">
                    ${w.username} - ₱${w.amount}<br>${w.number}
                    <button onclick="approveWithdrawal('${child.key}')">Approve</button>
                </div>`;
            }
        });
        document.getElementById('admin-withdrawals').innerHTML = html;
    });
}

window.approveWithdrawal = function(key) {
    update(ref(db, `withdrawals/${key}`), { status: 'completed' });
};

// --- TAB SYSTEM ---
window.showTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active-tab');
    event.currentTarget.classList.add('active');
    if(tabId === 'leaderboard') loadLeaderboard();
};

// Auto-Refresh Cooldowns every second
setInterval(() => {
    get(userRef).then(snap => {
        if(snap.exists()) checkCooldowns(snap.val().lastAdTime, snap.val().lastPopTime);
    });
}, 1000);
