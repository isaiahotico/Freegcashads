
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Initialize Telegram User
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: "Guest_" + Math.floor(Math.random()*1000), first_name: "Guest" };
const userId = user.id.toString();

let currentBalance = 0;

// 1. Sync User Data
function syncUser() {
    const userRef = ref(db, 'users/' + userId);
    onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentBalance = data.balance || 0;
            document.getElementById('user-balance').innerText = currentBalance.toFixed(2);
        } else {
            set(userRef, { name: user.first_name, balance: 0 });
        }
    });
}

// 2. Monetag Ad Function
window.watchAd = function() {
    if (typeof show_10276123 === 'function') {
        show_10276123().then(() => {
            rewardUser(0.01);
            tg.showAlert("Success! You earned ₱0.01");
        }).catch(e => tg.showAlert("Ad failed to load. Try again."));
    }
};

window.watchPopupAd = function() {
    show_10276123('pop').then(() => {
        rewardUser(0.01);
    });
};

function rewardUser(amount) {
    const newBalance = parseFloat((currentBalance + amount).toFixed(2));
    update(ref(db, 'users/' + userId), { balance: newBalance });
}

// 3. Navigation
window.showSection = function(section) {
    document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(section + '-sec').classList.remove('hidden');
    
    if (section === 'leaderboard') loadLeaderboard();
    if (section === 'chat') loadChat();
};

// 4. Leaderboard
function loadLeaderboard() {
    const usersRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    onValue(usersRef, (snapshot) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        let players = [];
        snapshot.forEach(child => { players.push(child.val()); });
        players.reverse().forEach((p, i) => {
            list.innerHTML += `
                <div class="card p-3 flex justify-between items-center">
                    <span>${i+1}. ${p.name}</span>
                    <span class="text-yellow-400 font-bold">₱${p.balance.toFixed(2)}</span>
                </div>`;
        });
    });
}

// 5. Chat System
window.sendMessage = function() {
    const input = document.getElementById('chat-input');
    if (input.value.trim() === "") return;
    push(ref(db, 'chats'), {
        name: user.first_name,
        msg: input.value,
        timestamp: Date.now()
    });
    input.value = "";
};

function loadChat() {
    const chatRef = query(ref(db, 'chats'), limitToLast(20));
    onValue(chatRef, (snapshot) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snapshot.forEach(child => {
            const data = child.val();
            box.innerHTML += `<div class="text-sm">
                <span class="text-yellow-500 font-bold">${data.name}:</span> 
                <span class="text-slate-200">${data.msg}</span>
            </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// 6. Withdrawals
window.requestWithdrawal = function() {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const gcash = document.getElementById('gcash-num').value;

    if (amount < 0.02) return tg.showAlert("Min withdrawal is ₱0.02");
    if (amount > currentBalance) return tg.showAlert("Insufficient balance");
    if (gcash.length < 10) return tg.showAlert("Enter valid GCash number");

    const newBalance = parseFloat((currentBalance - amount).toFixed(2));
    update(ref(db, 'users/' + userId), { balance: newBalance });
    push(ref(db, 'withdrawals'), {
        userId, name: user.first_name, amount, gcash, status: 'pending'
    });
    tg.showAlert("Withdrawal submitted! Wait 24h.");
};

// 7. Admin Dashboard
window.checkAdmin = function() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
};

function loadAdminData() {
    onValue(ref(db, 'withdrawals'), (snapshot) => {
        const container = document.getElementById('admin-withdrawals');
        container.innerHTML = "";
        snapshot.forEach(child => {
            const w = child.val();
            container.innerHTML += `
                <div class="p-2 border border-slate-600 rounded">
                    ${w.name} | ${w.gcash} | ₱${w.amount} 
                    <button class="bg-green-600 px-2 ml-2" onclick="alert('Paid!')">Mark Paid</button>
                </div>`;
        });
    });
}

// Start app
syncUser();
// Auto-show In-App Interstitial
show_10276123({
  type: 'inApp',
  inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
});
