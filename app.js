
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, serverTimestamp, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Initialize Telegram
const tg = window.Telegram?.WebApp;
const username = tg?.initDataUnsafe?.user?.username || "Guest_" + Math.floor(Math.random() * 1000);
const userId = tg?.initDataUnsafe?.user?.id || "anonymous";

document.getElementById('user-display-name').innerText = `@${username}`;

// State
let userBalance = 0;
let lastMessageTime = 0;

// --- PAGE NAVIGATION ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

// --- USER INITIALIZATION ---
const userRef = ref(db, 'users/' + userId);
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        userBalance = data.balance || 0;
        document.getElementById('main-balance').innerText = userBalance.toFixed(3);
        document.getElementById('my-ref-code').innerText = data.referralCode || userId;
        document.getElementById('claimable-bonus').innerText = (data.bonusBalance || 0).toFixed(3);
    } else {
        set(userRef, {
            username: username,
            balance: 0,
            referralCode: userId,
            bonusBalance: 0,
            joinedAt: serverTimestamp()
        });
    }
});

// --- AD LOGIC & CHAT ---
window.handleSendMessage = async () => {
    const now = Date.now();
    if (now - lastMessageTime < 180000) { // 3 min cooldown
        alert("Cooldown active. Wait 3 minutes.");
        return;
    }

    const msg = document.getElementById('chat-input').value;
    if (!msg) return;

    try {
        // Trigger 3 Rewarded Interstitial Ads
        await show_10276123(); 
        await show_10337795();
        await show_10337853();

        // Reward User
        const reward = 0.015;
        update(userRef, { balance: userBalance + reward });

        // Check for Upliner Bonus (8%)
        checkUplinerBonus(reward);

        // Send Message
        const chatRef = ref(db, 'messages');
        push(chatRef, {
            username: username,
            text: msg,
            timestamp: serverTimestamp()
        });

        document.getElementById('chat-input').value = "";
        lastMessageTime = now;
        alert("Message sent! You earned 0.015 PHP");
    } catch (e) {
        alert("Ad failed or was closed early.");
    }
};

// --- CHAT SYNC & CLEANUP ---
const chatBox = document.getElementById('chat-box');
onValue(query(ref(db, 'messages'), limitToLast(50)), (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach(child => {
        const m = child.val();
        chatBox.innerHTML += `<p><b>${m.username}:</b> ${m.text}</p>`;
    });
    chatBox.scrollTop = chatBox.scrollHeight;
});

// --- REFERRALS ---
async function checkUplinerBonus(amount) {
    onValue(userRef, (snap) => {
        const inviter = snap.val()?.invitedBy;
        if (inviter) {
            const uplinerRef = ref(db, 'users/' + inviter);
            const bonus = amount * 0.08;
            // Atomic update would be better here, but for simplicity:
            // logic to increment upliner's bonusBalance
        }
    }, { onlyOnce: true });
}

window.activateReferral = () => {
    const code = document.getElementById('input-ref-code').value;
    if(code === userId) return alert("Cannot use your own code");
    update(userRef, { invitedBy: code });
    alert("Referral activated!");
};

// --- WITHDRAWALS ---
window.requestWithdrawal = () => {
    const amount = parseFloat(document.getElementById('wd-amount').value);
    const num = document.getElementById('wd-number').value;

    if (amount > userBalance || amount < 1) return alert("Invalid amount");

    const wdRef = push(ref(db, 'withdrawals'));
    set(wdRef, {
        uid: userId,
        username: username,
        amount: amount,
        number: num,
        status: 'pending',
        date: new Date().toLocaleDateString()
    });

    update(userRef, { balance: userBalance - amount });
    alert("Withdrawal request sent!");
};

// --- OWNER DASHBOARD ---
window.checkAdmin = () => {
    const pw = document.getElementById('admin-pw').value;
    if (pw === "Propetas12") {
        showPage('owner-dashboard');
        loadAdminWithdrawals();
    } else {
        alert("Wrong Password");
    }
};

function loadAdminWithdrawals() {
    const adminList = document.getElementById('admin-wd-list');
    onValue(ref(db, 'withdrawals'), (snapshot) => {
        adminList.innerHTML = "";
        snapshot.forEach(child => {
            const wd = child.val();
            if(wd.status === 'pending') {
                adminList.innerHTML += `
                    <div class="bg-gray-700 p-2 rounded text-xs flex justify-between">
                        <div>${wd.username} - ${wd.amount} PHP<br>${wd.number}</div>
                        <button onclick="approveWd('${child.key}')" class="bg-green-600 px-2 rounded">Approve</button>
                    </div>`;
            }
        });
    });
}

window.approveWd = (key) => {
    update(ref(db, `withdrawals/${key}`), { status: 'approved' });
};

// --- LEADERBOARD ---
onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(50)), (snapshot) => {
    const table = document.getElementById('leaderboard-table');
    table.innerHTML = "";
    let ranks = [];
    snapshot.forEach(child => {
        ranks.push(child.val());
    });
    ranks.reverse().forEach((u, i) => {
        table.innerHTML += `<tr><td class="p-2">${i+1}</td><td class="p-2">${u.username}</td><td class="p-2">${u.balance.toFixed(2)}</td></tr>`;
    });
});

// Placeholder Ad Functions (Must be defined globally by your Monetag script)
async function show_10276123() { return new Promise(res => res()); }
async function show_10337795() { return new Promise(res => res()); }
async function show_10337853() { return new Promise(res => res()); }
