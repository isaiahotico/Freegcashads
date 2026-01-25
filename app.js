
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast, onDisconnect, serverTimestamp } 
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

// User Setup
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || { id: "Guest_" + Math.random().toString(36).substr(2, 5), first_name: "User" };
const userId = user.id.toString();
let userData = { balance: 0, name: user.first_name };

// Cooldown Tracker
let cooldowns = {
    main: 0,
    pop: 0,
    chat: 0
};

// 1. Core Logic & Presence
function initApp() {
    const userRef = ref(db, 'users/' + userId);
    onValue(userRef, (snap) => {
        if (snap.exists()) {
            userData = snap.val();
            document.getElementById('user-balance').innerText = userData.balance.toFixed(4);
        } else {
            set(userRef, { name: user.first_name, balance: 0, online: true, lastActive: serverTimestamp() });
        }
    });

    // Online Presence
    const statusRef = ref(db, 'users/' + userId + '/online');
    onDisconnect(statusRef).set(false);
    update(ref(db, 'users/' + userId), { online: true, lastActive: serverTimestamp() });

    // Global Online Counter
    onValue(ref(db, 'users'), (snap) => {
        let count = 0;
        let onlineHtml = "";
        snap.forEach(child => {
            if (child.val().online) {
                count++;
                onlineHtml += `<div class="glass p-2 rounded-lg text-xs">🟢 ${child.val().name}</div>`;
            }
        });
        document.getElementById('online-count').innerText = count;
        document.getElementById('online-list').innerHTML = onlineHtml;
    });

    startAutoAds();
    updateTimers();
}

// 2. Ad Reward Logic
window.watchMainAd = function() {
    if (Date.now() < cooldowns.main) return;
    show_10276123().then(() => {
        processReward(0.01);
        setCooldown('main', 45);
    });
};

window.watchQuickPop = function() {
    if (Date.now() < cooldowns.pop) return;
    show_10276123('pop').then(() => {
        processReward(0.0095);
        setCooldown('pop', 60);
    });
};

window.sendChatMessage = async function() {
    if (Date.now() < cooldowns.chat) {
        tg.showAlert("Chat reward cooling down!");
        return;
    }
    const msg = document.getElementById('chat-input').value;
    if (!msg) return;

    // Trigger Chat Ads (3 ads)
    tg.showConfirm("Watch 3 Quick Ads to send and earn ₱0.0145?", (ok) => {
        if (ok) {
            show_10276123('pop').then(() => {
                show_10276123('pop').then(() => {
                    show_10276123('pop').then(() => {
                        processReward(0.0145);
                        push(ref(db, 'chats'), { name: user.first_name, msg, timestamp: serverTimestamp() });
                        document.getElementById('chat-input').value = "";
                        setCooldown('chat', 120);
                    });
                });
            });
        }
    });
};

function processReward(amt) {
    const newBal = (userData.balance || 0) + amt;
    update(ref(db, 'users/' + userId), { balance: newBal });
}

function setCooldown(type, sec) {
    cooldowns[type] = Date.now() + (sec * 1000);
}

function updateTimers() {
    setInterval(() => {
        const now = Date.now();
        updateBtn('btn-main-ad', 'cd-main', cooldowns.main, "Watch Ad (₱0.01)");
        updateBtn('btn-pop-ad', 'cd-pop', cooldowns.pop, "Claim");
        const chatTime = Math.max(0, Math.ceil((cooldowns.chat - now)/1000));
        document.getElementById('cd-chat').innerText = chatTime > 0 ? `Reward ready in ${chatTime}s` : "Reward Ready!";
    }, 1000);
}

function updateBtn(btnId, txtId, target, original) {
    const now = Date.now();
    const btn = document.getElementById(btnId);
    const txt = document.getElementById(txtId);
    const diff = Math.max(0, Math.ceil((target - now)/1000));
    if (diff > 0) {
        btn.disabled = true;
        txt.innerText = `Wait ${diff}s`;
    } else {
        btn.disabled = false;
        txt.innerText = "";
    }
}

// 3. Auto Ads (Popunder & Native)
function startAutoAds() {
    // Popunder - Every 1 Hour
    setInterval(() => {
        const script = document.createElement('script');
        script.dataset.zone = '10049581';
        script.src = 'https://al5sm.com/tag.min.js';
        document.body.appendChild(script);
        tg.showScanQrPopup({ text: "Checking for bonus system..." });
        setTimeout(() => tg.closeScanQrPopup(), 2000);
    }, 3600000);

    // Native - Every 30 Minutes
    setInterval(() => {
        const script = document.createElement('script');
        script.dataset.zone = '10109465';
        script.src = 'https://groleegni.net/vignette.min.js';
        document.body.appendChild(script);
    }, 1800000);
}

// 4. Withdrawal & History
window.submitWithdrawal = function() {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const gcash = document.getElementById('wd-gcash').value;
    if (amt < 1.0) return tg.showAlert("Minimum withdraw is ₱1.00");
    if (amt > userData.balance) return tg.showAlert("Insufficient balance");
    if (gcash.length < 10) return tg.showAlert("Invalid GCash number");

    const wdData = {
        userId,
        name: user.first_name,
        amount: amt,
        gcash: gcash,
        status: "Pending",
        time: new Date().toLocaleString()
    };

    update(ref(db, 'users/' + userId), { balance: userData.balance - amt });
    push(ref(db, 'withdrawals'), wdData);
    tg.showAlert("Payout Request Sent!");
};

function loadHistory() {
    const q = query(ref(db, 'withdrawals'), orderByChild('userId'));
    onValue(q, (snap) => {
        let html = "";
        snap.forEach(child => {
            const w = child.val();
            if (w.userId === userId) {
                html += `
                <div class="glass p-3 rounded-xl text-xs flex justify-between">
                    <div>
                        <p class="font-bold">₱${w.amount.toFixed(2)}</p>
                        <p class="text-[10px] text-slate-500">${w.time}</p>
                    </div>
                    <span class="text-yellow-500">${w.status}</span>
                </div>`;
            }
        });
        document.getElementById('my-history').innerHTML = html || "<p class='text-center text-xs text-slate-500'>No history yet</p>";
    });
}

// 5. Admin Logic
window.verifyAdmin = function() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        loadAdminPanel();
    } else {
        alert("Access Denied");
    }
};

function loadAdminPanel() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        let html = "";
        snap.forEach(child => {
            const w = child.val();
            html += `
            <div class="bg-slate-800 p-2 rounded border-l-4 border-yellow-500">
                <p>NAME: ${w.name} | GCASH: ${w.gcash}</p>
                <p>AMT: ₱${w.amount} | STATUS: ${w.status}</p>
                <p class="text-slate-500">${w.time}</p>
                <button onclick="markPaid('${child.key}')" class="bg-green-600 px-2 py-1 mt-1 rounded">Mark Paid</button>
            </div>`;
        });
        document.getElementById('admin-wd-list').innerHTML = html;
    });
}

// Navigation Helper
window.showSection = (id) => {
    document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(id + '-sec').classList.remove('hidden');
    if (id === 'history') loadHistory();
    if (id === 'chat') loadChat();
};

function loadChat() {
    onValue(query(ref(db, 'chats'), limitToLast(15)), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(c => {
            box.innerHTML += `<div><b class="text-yellow-500">${c.val().name}:</b> ${c.val().msg}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

window.toggleTop = (type) => {
    document.getElementById('ranks-list').classList.toggle('hidden', type !== 'ranks');
    document.getElementById('online-list').classList.toggle('hidden', type !== 'online');
};

initApp();
