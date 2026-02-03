
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, query, orderByChild, limitToLast, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const HIGH_REWARD = 0.0102;
const RANDOM_REWARD = 0.012;
const HIGH_COOLDOWN_MS = 30 * 1000; // 30 seconds
const RANDOM_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const INITIAL_AD_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes

const AD_ZONES = [
    'show_10555663',
    'show_10555746',
    'show_10555727'
     ];

const PSYCHOLOGICAL_TIPS = [
    "Tip: Consistency is key. Small earnings daily build a big balance!",
    "Tip: Don't chase quick riches. Focus on steady, reliable income.",
    "Tip: Think of your balance as a savings account. Every cent counts!",
    "Tip: The best time to earn was yesterday. The second best time is now.",
    "Tip: Set a daily earning goal and stick to it!",
    "Tip: Use the chat room to find earning strategies from others.",
    "Tip: Patience pays off. Cooldowns are designed to protect the ad revenue.",
    "Tip: Invite friends! More users mean more ad revenue and better payouts.",
    "Tip: Check the leaderboard to motivate yourself to earn more.",
    "Tip: Treat this like a micro-job. Dedicate 5 minutes every hour.",
    "Tip: Don't let a low balance discourage you. It grows faster than you think.",
    "Tip: The power of compound earnings starts with the first cent.",
    "Tip: Financial success is 80% behavior and 20% knowledge.",
    "Tip: Avoid checking your balance too often; focus on the clicks!",
    "Tip: Remember, every ad view helps keep the system running for everyone.",
    "Tip: The secret to wealth is simple: spend less than you earn.",
    "Tip: Small habits, when repeated, lead to massive results.",
    "Tip: Never depend on a single source of income. Diversify!",
    "Tip: The best investment you can make is in yourself.",
    "Tip: Success is the sum of small efforts repeated day in and day out.",
    "Tip: Don't wait for opportunity. Create it.",
    "Tip: Discipline is choosing between what you want now and what you want most.",
    "Tip: Learning to manage small amounts is the first step to managing large ones.",
    "Tip: Wealth is not about having a lot of money, it's about having options.",
    "Tip: Your net worth is determined by your network.",
    "Tip: The biggest risk is not taking any risk.",
    "Tip: Focus on being productive, not just busy.",
    "Tip: A budget is telling your money where to go instead of wondering where it went.",
    "Tip: Prioritize earning over spending.",
    "Tip: The earlier you start earning, the better.",
    "Tip: Don't underestimate the power of consistency.",
    "Tip: Every penny saved or earned is a soldier fighting for your financial freedom.",
    "Tip: Financial freedom starts with small, deliberate actions.",
    "Tip: Don't just work for money; make money work for you.",
    "Tip: The difference between a rich person and a poor person is how they use their time.",
    "Tip: Never stop learning new ways to earn.",
    "Tip: Be patient with the results, but impatient with the action.",
    "Tip: The key to earning is to start before you are ready.",
    "Tip: Your attitude determines your altitude.",
    "Tip: Don't compare your beginning to someone else's middle.",
    "Tip: Focus on the process, not just the outcome.",
    "Tip: The most valuable asset you have is your time.",
    "Tip: Small changes eventually add up to huge results.",
    "Tip: Stop buying things you don't need to impress people you don't like.",
    "Tip: The journey of a thousand miles begins with a single click.",
    "Tip: Use the chat to share your success stories!",
    "Tip: Remember to take breaks and come back refreshed.",
    "Tip: Your future self will thank you for earning today.",
    "Tip: Don't quit because of slow progress; slow progress is still progress.",
    "Tip: Every ad view is a step closer to your GCash payout!"
];

// --- INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const tg = window.Telegram.WebApp;
tg.expand();

// Get actual Telegram user data
const user = tg.initDataUnsafe?.user || { id: "Guest_" + Date.now(), first_name: "User", username: "GuestUser" };
const userId = user.id;
const userName = user.username ? `@${user.username}` : user.first_name || "Anonymous User";

// Display user name immediately
document.getElementById('user-display-name').innerText = `Welcome, ${userName}`;

// Global State
let userBalance = 0;
let totalAds = 0;
let lastHighReward = 0;
let lastRandomReward = 0;
let lastInitialAd = 0;

// --- UTILITY FUNCTIONS ---

function getRandomAdZone() {
    const randomIndex = Math.floor(Math.random() * AD_ZONES.length);
    return window[AD_ZONES[randomIndex]];
}

function updateBalance(reward) {
    const newBalance = userBalance + reward;
    const newTotal = totalAds + 1;
    
    // Use update to avoid overwriting other fields accidentally
    update(userRef, { 
        username: userName, 
        balance: parseFloat(newBalance.toFixed(4)), 
        totalAds: newTotal,
        lastHighReward: lastHighReward,
        lastRandomReward: lastRandomReward,
        lastInitialAd: lastInitialAd
    });

    // Show psychological tip
    const tip = PSYCHOLOGICAL_TIPS[Math.floor(Math.random() * PSYCHOLOGICAL_TIPS.length)];
    tg.showAlert(`✅ Earned ₱${reward.toFixed(4)}!\n\n${tip}`);
}

function formatTime(ms) {
    if (ms <= 0) return "Ready!";
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}

function checkCooldowns() {
    const now = Date.now();
    
    // High Reward Cooldown
    const highRemaining = HIGH_COOLDOWN_MS - (now - lastHighReward);
    const highBtn = document.getElementById('btn-high-reward');
    const highText = document.getElementById('cooldown-high');
    
    // Random Reward Cooldown
    const randomRemaining = RANDOM_COOLDOWN_MS - (now - lastRandomReward);
    const randomBtn = document.getElementById('btn-random-reward');
    const randomText = document.getElementById('cooldown-random');

    [
        { btn: highBtn, text: highText, remaining: highRemaining, cooldown: HIGH_COOLDOWN_MS },
        { btn: randomBtn, text: randomText, remaining: randomRemaining, cooldown: RANDOM_COOLDOWN_MS }
    ].forEach(({ btn, text, remaining }) => {
        const isReady = remaining <= 0;
        btn.disabled = !isReady;
        text.innerText = isReady ? "Ready to earn!" : `Cooldown: ${formatTime(remaining)}`;
        
        if (btn === highBtn) {
            btn.classList.toggle('btn-grad', isReady);
            btn.classList.toggle('bg-gray-400', !isReady);
        } else {
            btn.classList.toggle('bg-yellow-500', isReady);
            btn.classList.toggle('bg-gray-400', !isReady);
        }
    });
}

setInterval(checkCooldowns, 1000); // Check cooldowns every second

// --- FIREBASE SYNC & INITIAL SETUP ---
const userRef = ref(db, 'users/' + userId);
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        userBalance = data.balance || 0;
        totalAds = data.totalAds || 0;
        lastHighReward = data.lastHighReward || 0;
        lastRandomReward = data.lastRandomReward || 0;
        lastInitialAd = data.lastInitialAd || 0;
        
        document.getElementById('user-balance').innerText = userBalance.toFixed(4);
        document.getElementById('total-ads').innerText = totalAds;
        checkCooldowns();
        showInitialAd(); // Check and show initial ad after loading data
    } else {
        // New user setup
        set(userRef, { 
            username: userName, 
            balance: 0, 
            totalAds: 0, 
            lastHighReward: 0, 
            lastRandomReward: 0,
            lastInitialAd: 0,
            isBanned: false 
        });
    }
});

// --- MONETAG AD FUNCTIONS ---

// Initial Random In-App Interstitial Ad (3 minute cooldown)
function showInitialAd() {
    const now = Date.now();
    if (now - lastInitialAd < INITIAL_AD_COOLDOWN_MS) {
        return; // Still in cooldown
    }

    const adFunction = getRandomAdZone();
    
    try {
        adFunction({
            type: 'inApp',
            inAppSettings: {
                frequency: 1, 
                capping: 0.1,
                interval: 30,
                timeout: 5,
                everyPage: false
            }
        });
        
        // Update the last shown time
        lastInitialAd = now;
        update(userRef, { lastInitialAd: now });

    } catch(e) {
        console.error("Initial ad failed:", e);
    }
}

// 1. High Reward Ad (0.0065, 30s cooldown)
window.watchHighRewardAd = function() {
    if (Date.now() - lastHighReward < HIGH_COOLDOWN_MS) {
        return tg.showAlert("Please wait for the 30-second cooldown.");
    }
    
    tg.MainButton.setText("LOADING AD...").show();
    const adFunction = getRandomAdZone();

    adFunction().then(() => {
        lastHighReward = Date.now();
        updateBalance(HIGH_REWARD);
        tg.MainButton.hide();
    }).catch(() => {
        tg.showAlert("Ad failed to load or was skipped. Please try again.");
        tg.MainButton.hide();
    });
};

// 2. Random Popup Reward Ad (0.012, 10 min cooldown)
window.watchRandomRewardAd = function() {
    if (Date.now() - lastRandomReward < RANDOM_COOLDOWN_MS) {
        return tg.showAlert("Please wait for the 10-minute cooldown.");
    }

    tg.MainButton.setText("LOADING REWARD...").show();
    const adFunction = getRandomAdZone();

    adFunction('pop').then(() => {
        lastRandomReward = Date.now();
        updateBalance(RANDOM_REWARD);
        tg.MainButton.hide();
    }).catch(() => {
        tg.showAlert("Ad failed to load or was skipped. Please try again.");
        tg.MainButton.hide();
    });
};


// --- NAVIGATION & UI ---
window.showPage = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('nav-active'));
    event.currentTarget.classList.add('nav-active');
    
    if(pageId === 'leaderboard') loadLeaderboard();
    if(pageId === 'wallet') loadWithdrawalHistory();
};

// --- LEADERBOARD ---
function loadLeaderboard() {
    const usersQuery = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    get(usersQuery).then(snap => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        let players = [];
        snap.forEach(child => { players.push(child.val()); });
        players.reverse().forEach((p, i) => {
            list.innerHTML += `
                <div class="glass-card p-3 flex justify-between items-center ${p.username === userName ? 'border-2 border-sky-500' : ''}">
                    <span class="font-bold text-sky-600">#${i+1} ${p.username}</span>
                    <span class="font-black text-gray-700">₱${p.balance.toFixed(4)}</span>
                </div>`;
        });
    });
}

// --- CHAT LOGIC ---
window.sendMessage = function() {
    const text = document.getElementById('chat-input').value;
    if(!text) return;
    push(ref(db, 'chat'), {
        user: userName,
        text: text,
        timestamp: Date.now()
    });
    document.getElementById('chat-input').value = "";
};

onValue(query(ref(db, 'chat'), limitToLast(20)), (snap) => {
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    snap.forEach(child => {
        const m = child.val();
        box.innerHTML += `<div class="p-2 bg-blue-50 rounded-lg text-sm shadow-sm">
            <b class="text-sky-600">${m.user}:</b> ${m.text}
        </div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// --- WITHDRAWAL LOGIC (User Side) ---
window.requestWithdrawal = function() {
    const gcash = document.getElementById('gcash-num').value;
    const amount = parseFloat(document.getElementById('wd-amount').value);
    
    if(amount < 0.994) return tg.showAlert("Minimum withdrawal is ₱1");
    if(amount > userBalance) return tg.showAlert("Insufficient balance!");
    if(gcash.length < 10) return tg.showAlert("Enter valid GCash number");

    // 1. Create the withdrawal request
    push(ref(db, 'withdrawals'), {
        userId, username: userName, gcash, amount: amount.toFixed(4), status: 'Pending', timestamp: Date.now()
    });

    // 2. Deduct the balance immediately (Admin refunds if rejected)
    update(userRef, { 
        balance: parseFloat((userBalance - amount).toFixed(4)),
    });
    
    tg.showAlert("Withdrawal submitted! It is now pending admin approval.");
};

function loadWithdrawalHistory() {
    // This listener ensures auto-sync of status changes from the admin
    const historyRef = query(ref(db, 'withdrawals'), orderByChild('timestamp'));
    onValue(historyRef, snap => {
        const historyList = document.getElementById('withdrawal-history');
        historyList.innerHTML = "";
        let found = false;

        snap.forEach(child => {
            const w = child.val();
            if (w.userId == userId) {
                found = true;
                const statusColor = w.status === 'Paid' ? 'text-green-600' : (w.status === 'Pending' ? 'text-orange-500' : 'text-red-600');
                const date = new Date(w.timestamp).toLocaleDateString();
                
                historyList.innerHTML = `
                    <div class="p-3 border-b flex justify-between items-center text-sm">
                        <div>
                            <p class="font-bold">₱${w.amount} to ${w.gcash}</p>
                            <p class="text-xs text-gray-500">${date}</p>
                        </div>
                        <span class="${statusColor} font-semibold">${w.status}</span>
                    </div>` + historyList.innerHTML;
            }
        });

        if (!found) {
            historyList.innerHTML = '<p class="text-gray-500 text-sm p-2">No withdrawal history found.</p>';
        }
    });
}


// --- ADMIN LOGIC ---
window.checkAdmin = function() {
    const pass = document.getElementById('admin-pass').value;
    if(pass === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
        loadAdminWithdrawals();
    } else {
        alert("Wrong Password");
    }
};

function loadAdminWithdrawals() {
    // Auto-sync admin view for new requests and status changes
    const adminQuery = query(ref(db, 'withdrawals'), orderByChild('status'));
    onValue(adminQuery, snap => {
        const list = document.getElementById('withdrawal-list');
        list.innerHTML = "";
        
        snap.forEach(child => {
            const w = child.val();
            const key = child.key;
            const statusColor = w.status === 'Paid' ? 'bg-green-100' : (w.status === 'Pending' ? 'bg-yellow-100' : 'bg-red-100');
            
            list.innerHTML += `
                <div class="p-3 ${statusColor} rounded-lg mb-2 shadow-sm">
                    <p class="font-bold">Amount: ₱${w.amount} (${w.status})</p>
                    <p class="text-sm">User: ${w.username} (ID: ${w.userId})</p>
                    <p class="text-sm mb-2">GCash: ${w.gcash}</p>
                    ${w.status === 'Pending' ? 
                        `<button class="bg-green-500 text-white px-3 py-1 rounded text-xs mr-2" onclick="markAsPaid('${key}')">Mark Paid</button>
                         <button class="bg-red-500 text-white px-3 py-1 rounded text-xs" onclick="markAsRejected('${key}', '${w.userId}', ${w.amount})">Reject & Refund</button>` :
                        `<span class="text-gray-700 text-xs">Status: ${w.status}</span>`
                    }
                </div>`;
        });
    });
}

// Admin Action: Mark Paid
window.markAsPaid = function(key) {
    if (confirm(`Confirm payment for withdrawal ${key}?`)) {
        // Update status in withdrawals. This auto-syncs the user's history.
        update(ref(db, 'withdrawals/' + key), { status: 'Paid' })
            .then(() => tg.showAlert(`Payment recorded.`))
            .catch(e => tg.showAlert(`Error marking paid: ${e.message}`));
    }
};

// Admin Action: Reject and Refund
window.markAsRejected = function(key, userId, amount) {
    if (confirm(`WARNING: Rejecting this request will refund ₱${amount} to the user. Proceed?`)) {
        // 1. Update withdrawal status
        update(ref(db, 'withdrawals/' + key), { status: 'Rejected' });

        // 2. Refund the user's balance
        const userToRefundRef = ref(db, 'users/' + userId);
        get(userToRefundRef).then(snapshot => {
            const userData = snapshot.val();
            if (userData) {
                const currentBalance = userData.balance || 0;
                const newBalance = parseFloat(currentBalance) + parseFloat(amount);
                update(userToRefundRef, { balance: parseFloat(newBalance.toFixed(4)) });
                tg.showAlert(`Request rejected and ₱${amount} refunded to user ${userId}.`);
            }
        });
    }
};
