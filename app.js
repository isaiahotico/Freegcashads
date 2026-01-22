
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Mock User ID (In Telegram, use window.Telegram.WebApp.initDataUnsafe.user.id)
let userId = localStorage.getItem('ph_user_id') || 'user_' + Math.floor(Math.random() * 999999);
localStorage.setItem('ph_user_id', userId);

let userData = {};

// Initial Load
function initUser() {
    db.ref('users/' + userId).on('value', (snapshot) => {
        if (!snapshot.exists()) {
            // New User Setup
            userData = {
                id: userId,
                name: "Player_" + userId.slice(-4),
                balance: 0,
                totalEarned: 0,
                referralCode: userId,
                referredBy: "",
                lastAd1: 0,
                lastAd2: 0,
                lastAd3: 0
            };
            db.ref('users/' + userId).set(userData);
        } else {
            userData = snapshot.val();
        }
        updateUI();
    });
}

function updateUI() {
    document.getElementById('user-balance').innerText = userData.balance.toFixed(2);
    document.getElementById('prof-name').innerText = userData.name;
    document.getElementById('prof-total').innerText = userData.totalEarned.toFixed(2);
    document.getElementById('ref-code').value = userData.referralCode;
    updateTimers();
}

// Tab Switching
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if(tabId === 'leaderboard') loadLeaderboard();
    if(tabId === 'chat') loadChat();
}

// Monetag Integration & Reward Logic
function watchAd(type) {
    let now = Date.now();
    let config = {
        1: { reward: 0.02, cooldown: 5 * 60 * 1000, key: 'lastAd1', btn: 'adBtn1' },
        2: { reward: 0.01, cooldown: 2 * 60 * 1000, key: 'lastAd2', btn: 'adBtn2' },
        3: { reward: 0.05, cooldown: 10 * 60 * 1000, key: 'lastAd3', btn: 'adBtn3' }
    };

    let selected = config[type];
    if (now - (userData[selected.key] || 0) < selected.cooldown) {
        alert("Wait for cooldown!");
        return;
    }

    // Show Monetag Ad
    show_10276123('pop').then(() => {
        processReward(selected.reward, selected.key);
    }).catch(e => {
        // For testing/fallback if ad fails
        console.log("Ad Error: ", e);
        processReward(selected.reward, selected.key); 
    });
}

function processReward(amount, key) {
    const updates = {};
    updates[`users/${userId}/balance`] = firebase.database.ServerValue.increment(amount);
    updates[`users/${userId}/totalEarned`] = firebase.database.ServerValue.increment(amount);
    updates[`users/${userId}/${key}`] = Date.now();
    
    db.ref().update(updates);

    // Referral Commission (10%)
    if (userData.referredBy) {
        db.ref('users/' + userData.referredBy + '/balance').transaction(curr => (curr || 0) + (amount * 0.10));
    }
    alert(`Reward Claimed: ₱${amount}`);
}

// Timers Logic
function updateTimers() {
    const configs = [
        { id: 'timer1', btn: 'adBtn1', last: userData.lastAd1, cd: 5 * 60 * 1000 },
        { id: 'timer2', btn: 'adBtn2', last: userData.lastAd2, cd: 2 * 60 * 1000 },
        { id: 'timer3', btn: 'adBtn3', last: userData.lastAd3, cd: 10 * 60 * 1000 }
    ];

    configs.forEach(conf => {
        let remaining = conf.cd - (Date.now() - (conf.last || 0));
        let btn = document.getElementById(conf.btn);
        let lbl = document.getElementById(conf.id);

        if (remaining > 0) {
            btn.disabled = true;
            let mins = Math.floor(remaining / 60000);
            let secs = Math.floor((remaining % 60000) / 1000);
            lbl.innerText = `Wait ${mins}m ${secs}s`;
        } else {
            btn.disabled = false;
            lbl.innerText = "Ready to Watch";
        }
    });
}
setInterval(updateTimers, 1000);

// Chat System
function sendMessage() {
    const msg = document.getElementById('chat-input').value;
    if (!msg) return;
    db.ref('chats').push({
        name: userData.name,
        text: msg,
        time: Date.now()
    });
    document.getElementById('chat-input').value = "";
}

function loadChat() {
    db.ref('chats').limitToLast(20).on('value', snap => {
        let html = "";
        snap.forEach(child => {
            let m = child.val();
            html += `<div class="bg-slate-800 p-2 rounded-lg text-sm">
                <span class="text-cyan-400 font-bold">${m.name}:</span> ${m.text}
            </div>`;
        });
        const container = document.getElementById('chat-messages');
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    });
}

// Leaderboard
function loadLeaderboard() {
    db.ref('users').orderByChild('totalEarned').limitToLast(10).once('value', snap => {
        let html = "";
        let players = [];
        snap.forEach(child => { players.push(child.val()); });
        players.reverse().forEach((p, i) => {
            html += `<div class="flex justify-between p-3 border-b border-slate-800">
                <span>${i+1}. ${p.name}</span>
                <span class="text-green-400 font-bold">₱${p.totalEarned.toFixed(2)}</span>
            </div>`;
        });
        document.getElementById('leaderboard-list').innerHTML = html;
    });
}

// Withdrawal Request
function requestWithdrawal() {
    let num = document.getElementById('gcash-num').value;
    if (num.length < 10) return alert("Enter valid GCash number");
    if (userData.balance < 1) return alert("Minimum withdrawal is ₱1.00");

    db.ref('withdrawals').push({
        uid: userId,
        name: userData.name,
        gcash: num,
        amount: userData.balance,
        status: 'pending'
    });

    db.ref('users/' + userId + '/balance').set(0);
    alert("Withdrawal Requested!");
}

// Admin Logic
function checkAdmin() {
    let pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
}

function loadAdminData() {
    db.ref('withdrawals').on('value', snap => {
        let html = "";
        snap.forEach(child => {
            let w = child.val();
            if(w.status === 'pending') {
                html += `<div class="bg-slate-800 p-3 rounded mb-2 flex justify-between items-center text-xs">
                    <div>
                        <p>User: ${w.name}</p>
                        <p>GCash: ${w.gcash}</p>
                        <p>Amt: ₱${w.amount}</p>
                    </div>
                    <button onclick="approveWithdraw('${child.key}')" class="bg-green-600 px-2 py-1 rounded">Done</button>
                </div>`;
            }
        });
        document.getElementById('withdrawal-list').innerHTML = html || "No pending requests";
    });
}

function approveWithdraw(key) {
    db.ref('withdrawals/' + key).remove();
}

function copyRef() {
    let copyText = document.getElementById("ref-code");
    copyText.select();
    document.execCommand("copy");
    alert("Code Copied!");
}

// Startup
initUser();

// In-App Interstitial Auto-Show
show_10276123({
  type: 'inApp',
  inAppSettings: {
    frequency: 2,
    capping: 0.1,
    interval: 30,
    timeout: 5,
    everyPage: false
  }
});
