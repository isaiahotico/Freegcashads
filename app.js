
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, update, onValue, push, query, orderByChild, limitToLast, remove } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    databaseURL: "https://paper-house-inc-default-rtdb.firebaseio.com",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Telegram & User Init ---
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user || { id: "GUEST_USER", first_name: "Guest", username: "Guest" };
const uid = tgUser.id.toString();
document.getElementById('userBar').innerText = `👤 User: @${tgUser.username || tgUser.first_name}`;

let currentBal = 0;
onValue(ref(db, `users/${uid}`), (snap) => {
    if (snap.exists()) {
        currentBal = snap.val().balance;
        document.getElementById('balance').innerText = currentBal.toFixed(3);
    } else {
        set(ref(db, `users/${uid}`), { username: tgUser.first_name, balance: 0 });
    }
});

// --- Auto Ads (3 Min Cooldown) ---
function triggerLaunchAd() {
    const last = localStorage.getItem('last_auto_ad');
    if (!last || Date.now() - last > 180000) {
        const ads = [show_10276123, show_10337795, show_10337853];
        ads[Math.floor(Math.random()*3)]?.({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }});
        localStorage.setItem('last_auto_ad', Date.now());
    }
}

// --- Rewards & Animations ---
window.runAdTask = async (id, reward, type, cd) => {
    const btn = document.getElementById(`btn_${type}${id}`);
    btn.disabled = true;
    try {
        await show_10337853(); await show_10337795(); await show_10276123(); // Sequences
        triggerRandomAnim();
        alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
        document.getElementById(`claim_${type}${id}`).style.display = 'inline-block';
    } catch (e) { btn.disabled = false; }
};

window.claimReward = (id, amt, type, cdMins) => {
    update(ref(db, `users/${uid}`), { balance: currentBal + amt });
    localStorage.setItem(`${type}_cd_${id}`, Date.now() + (cdMins * 60 * 1000));
    document.getElementById(`claim_${type}${id}`).style.display = 'none';
    updateCooldowns();
};

function triggerRandomAnim() {
    const layer = document.getElementById('reward-anim-layer');
    layer.style.display = 'block';
    const sets = [['🍍', '🍍'], ['💰', '💵'], ['✨', '💎'], ['🎉', '🎊'], ['⭐', '🔥']];
    const set = sets[Math.floor(Math.random() * 5)];
    for(let i=0; i<15; i++) {
        const p = document.createElement('div');
        p.className = 'particle'; p.innerText = set[Math.floor(Math.random()*2)];
        p.style.left = Math.random() * 95 + 'vw';
        p.style.animationDelay = Math.random() * 2 + 's';
        layer.appendChild(p);
    }
    setTimeout(() => { layer.innerHTML = ''; layer.style.display = 'none'; }, 4000);
}

// --- Withdrawal Logic ---
window.requestWithdrawal = () => {
    const num = document.getElementById('gcashNumber').value;
    const amt = parseFloat(document.getElementById('gcashAmount').value);
    if (amt > currentBal || amt < 1) return alert("Insufficient Balance or Invalid Amount");
    if (num.length < 10) return alert("Invalid GCash Number");

    const wdRef = push(ref(db, 'withdrawals'));
    set(wdRef, { 
        uid, 
        username: tgUser.first_name, 
        number: num, 
        amount: amt, 
        status: 'pending', 
        date: new Date().toLocaleString() 
    });
    update(ref(db, `users/${uid}`), { balance: currentBal - amt });
    alert("Request Sent! Wait for Admin approval.");
};

// Sync User Withdrawal Table
onValue(ref(db, 'withdrawals'), (snap) => {
    const tbody = document.querySelector('#userWithdrawTable tbody');
    tbody.innerHTML = '';
    snap.forEach(child => {
        const w = child.val();
        if (w.uid === uid) {
            tbody.innerHTML += `<tr><td>${w.date}</td><td>${w.number}</td><td>₱${w.amount}</td><td class="status-${w.status}">${w.status.toUpperCase()}</td></tr>`;
        }
    });
});

// --- Admin Logic ---
window.adminAuth = () => {
    if (prompt("Admin Password:") === "Propetas6") {
        showPage('adminPage');
        syncAdminTable();
    } else { alert("Wrong Password"); }
};

function syncAdminTable() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const tbody = document.querySelector('#adminWithdrawTable tbody');
        tbody.innerHTML = '';
        snap.forEach(child => {
            const w = child.val();
            if (w.status === 'pending') {
                const row = `<tr>
                    <td>${w.username}</td><td>${w.number}</td><td>₱${w.amount}</td><td>${w.date}</td>
                    <td><button onclick="approveWD('${child.key}')" style="background:green; color:white; padding:5px;">Approve</button></td>
                </tr>`;
                tbody.innerHTML += row;
            }
        });
    });
}

window.approveWD = (key) => {
    update(ref(db, `withdrawals/${key}`), { status: 'approved' });
    alert("Withdrawal Approved!");
};

// --- Page & UI ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.getElementById(id).classList.add('active-page');
    if(id === 'leaderboardPage') syncLeaderboard();
};

function syncLeaderboard() {
    const q = query(ref(db, 'users'), orderByChild('balance'), limitToLast(20));
    onValue(q, (snap) => {
        const arr = []; snap.forEach(c => arr.push(c.val()));
        arr.reverse();
        const tbody = document.querySelector('#lbTable tbody');
        tbody.innerHTML = arr.map((u, i) => `<tr><td>${i+1}</td><td>${u.username}</td><td>₱${u.balance.toFixed(3)}</td></tr>`).join('');
    });
}

window.triggerRainbow = () => document.body.classList.add('rainbow-bg');
function updateCooldowns() {
    // Cooldown check logic here...
}
function updateFooter() { document.getElementById('footerTime').innerText = new Date().toLocaleString(); }
setInterval(updateFooter, 1000);
window.onload = () => { triggerLaunchAd(); updateCooldowns(); };
