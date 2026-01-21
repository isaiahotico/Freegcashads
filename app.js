
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, query, orderByChild, limitToLast } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    databaseURL: "https://paper-house-inc-default-rtdb.firebaseio.com", // Verify this in Firebase console
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Simple User Session (In a real Telegram app, use Telegram.WebApp.initDataUnsafe)
let userId = localStorage.getItem('ph_user_id') || 'user_' + Math.floor(Math.random() * 100000);
localStorage.setItem('ph_user_id', userId);

let userData = {
    balance: 0,
    totalAds: 0,
    referrals: 0,
    name: userId,
    referredBy: ""
};

// --- Initialization ---
async function initUser() {
    const snapshot = await get(ref(db, 'users/' + userId));
    if (snapshot.exists()) {
        userData = snapshot.val();
    } else {
        // Handle Referral code on first join
        const refCode = prompt("Enter Referral Code (Name) or leave blank:");
        if (refCode && refCode !== userId) {
            userData.referredBy = refCode;
        }
        await set(ref(db, 'users/' + userId), userData);
    }
    updateUI();
    loadLeaderboard();
    listenChat();
}

function updateUI() {
    document.getElementById('user-balance').innerText = `₱ ${userData.balance.toFixed(3)}`;
    document.getElementById('total-ads').innerText = userData.totalAds;
    document.getElementById('ref-count').innerText = userData.referrals || 0;
    document.getElementById('my-ref-code').innerText = userId;
}

// --- Ad Logic ---
window.watchAd = function() {
    // Calling Monetag Rewarded Interstitial
    if (typeof show_10276123 === 'function') {
        show_10276123().then(() => {
            rewardUser(0.01);
        }).catch(e => {
            alert("Ad failed to load. Please try again.");
        });
    } else {
        alert("Ad Blocked or Script not loaded");
    }
};

async function rewardUser(amount) {
    userData.balance += amount;
    userData.totalAds += 1;
    
    // Update User
    await update(ref(db, 'users/' + userId), {
        balance: userData.balance,
        totalAds: userData.totalAds
    });

    // Handle Referral Commission (10%)
    if (userData.referredBy) {
        const commission = amount * 0.10;
        const refRef = ref(db, 'users/' + userData.referredBy);
        const refSnap = await get(refRef);
        if (refSnap.exists()) {
            const currentBal = refSnap.val().balance || 0;
            update(refRef, { balance: currentBal + commission });
        }
    }
    
    updateUI();
    alert(`Reward Claimed! +₱${amount}`);
}

// --- Withdrawal ---
window.requestWithdraw = async function() {
    const num = document.getElementById('gcash-num').value;
    if (num.length < 10) return alert("Invalid GCash Number");
    if (userData.balance < 0.02) return alert("Minimum ₱0.02 required");

    const request = {
        userId: userId,
        amount: userData.balance,
        gcash: num,
        status: 'pending',
        timestamp: Date.now()
    };

    await push(ref(db, 'withdrawals'), request);
    userData.balance = 0;
    await update(ref(db, 'users/' + userId), { balance: 0 });
    updateUI();
    alert("Withdrawal Requested! Processing takes 24h.");
};

// --- Chat Room ---
function listenChat() {
    const chatRef = query(ref(db, 'chat'), limitToLast(20));
    onValue(chatRef, (snapshot) => {
        const container = document.getElementById('chat-messages');
        container.innerHTML = "";
        snapshot.forEach((child) => {
            const msg = child.val();
            const div = document.createElement('div');
            div.className = "bg-white/5 p-3 rounded-xl max-w-[80%]";
            div.innerHTML = `<p class="text-[10px] text-yellow-500">${msg.user}</p><p class="text-sm">${msg.text}</p>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
}

window.sendMessage = function() {
    const input = document.getElementById('chat-input');
    if (!input.value) return;
    push(ref(db, 'chat'), {
        user: userId,
        text: input.value,
        timestamp: Date.now()
    });
    input.value = "";
};

// --- Leaderboard ---
async function loadLeaderboard() {
    const topQuery = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    onValue(topQuery, (snapshot) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        let entries = [];
        snapshot.forEach(child => { entries.push(child.val()); });
        entries.reverse().forEach((u, i) => {
            list.innerHTML += `
                <div class="glass flex justify-between p-4 rounded-xl">
                    <span>#${i+1} ${u.name.substring(0,8)}...</span>
                    <span class="font-bold text-yellow-500">₱${u.balance.toFixed(2)}</span>
                </div>`;
        });
    });
}

// --- Admin Panel ---
window.openAdmin = function() {
    const pass = prompt("Admin Password:");
    if (pass === "Propetas12") {
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminData();
    } else {
        alert("Unauthorized");
    }
};

window.closeAdmin = () => document.getElementById('admin-panel').style.display = 'none';

async function loadAdminData() {
    // Load Pending Withdrawals
    onValue(ref(db, 'withdrawals'), (snapshot) => {
        const container = document.getElementById('withdrawal-requests');
        container.innerHTML = "";
        snapshot.forEach(child => {
            const w = child.val();
            if (w.status === 'pending') {
                container.innerHTML += `
                    <div class="bg-white/5 p-4 rounded-xl flex justify-between items-center">
                        <div>
                            <p class="text-sm">₱${w.amount.toFixed(2)} -> ${w.gcash}</p>
                            <p class="text-[10px]">${w.userId}</p>
                        </div>
                        <button onclick="approveWithdraw('${child.key}')" class="bg-green-600 px-3 py-1 rounded text-xs">Paid</button>
                    </div>`;
            }
        });
    });
}

window.approveWithdraw = (key) => update(ref(db, 'withdrawals/' + key), { status: 'paid' });

// Start the app
initUser();
