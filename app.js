
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast, serverTimestamp } 
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

// Telegram Config
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || { id: "0000", first_name: "User", username: "Guest" };
const uid = user.id.toString();
const myUsername = user.username || `user_${uid}`;

let userData = { balance: 0, refEarnings: 0 };
let cds = { main: 0, pop: 0, chat: 0 };

async function init() {
    tg.expand();
    document.getElementById('user-display').innerText = myUsername;
    document.getElementById('my-code').innerText = myUsername;

    const uRef = ref(db, 'users/' + uid);
    const snap = await get(uRef);
    if(!snap.exists()) {
        await set(uRef, { name: user.first_name, username: myUsername, balance: 0, refEarnings: 0, referredBy: null });
        await set(ref(db, 'usernames/' + myUsername), uid);
    }

    onValue(uRef, (s) => {
        userData = s.val();
        document.getElementById('user-bal').innerText = userData.balance.toFixed(4);
        document.getElementById('ref-earn').innerText = (userData.refEarnings || 0).toFixed(4);
    });

    // In-App Interstitial Logic
    showInApp(); // Once on launch
    setInterval(showInApp, 240000); // Every 4 mins

    // Native Ad Refresh Logic
    loadNative();
    setInterval(loadNative, 300000); // Every 5 mins

    // Popunder Logic
    setInterval(() => {
        const s = document.createElement('script');
        s.dataset.zone = '10049581';
        s.src = 'https://al5sm.com/tag.min.js';
        document.body.appendChild(s);
    }, 3600000); // Every 1 hour

    loopCooldowns();
}

// AD HANDLERS
function showInApp() {
    if (typeof show_10276123 === 'function') {
        show_10276123({
            type: 'inApp',
            inAppSettings: { frequency: 1, capping: 0, interval: 0, timeout: 0, everyPage: false }
        });
    }
}

function loadNative() {
    const box = document.getElementById('native-box');
    box.innerHTML = ""; // Clear for refresh
    const s = document.createElement('script');
    s.dataset.zone = '10109465'; 
    s.src = 'https://groleegni.net/vignette.min.js';
    box.appendChild(s);
}

window.watchMainAd = function() {
    if (Date.now() < cds.main) return;
    show_10276123().then(() => {
        reward(0.0100);
        cds.main = Date.now() + 45000;
    });
};

window.watchQuickPop = function() {
    if (Date.now() < cds.pop) return;
    show_10276123('pop').then(() => {
        reward(0.0095);
        cds.pop = Date.now() + 60000;
    });
};

window.sendChatMessage = async function() {
    if (Date.now() < cds.chat) return tg.showAlert("Chat cooling down!");
    const msg = document.getElementById('chat-input').value;
    if(!msg) return;

    tg.showConfirm("Watch 3 Interstitial ads to chat and earn ₱0.0186?", async (ok) => {
        if(ok) {
            try {
                await show_10276123(); // Ad 1
                await show_10276123(); // Ad 2
                await show_10276123(); // Ad 3
                reward(0.0186);
                push(ref(db, 'chats'), { name: myUsername, msg, timestamp: serverTimestamp() });
                document.getElementById('chat-input').value = "";
                cds.chat = Date.now() + 180000;
            } catch(e) { tg.showAlert("Ad Error!"); }
        }
    });
};

// CORE REWARD LOGIC
async function reward(amt) {
    const newBal = (userData.balance || 0) + amt;
    await update(ref(db, 'users/' + uid), { balance: newBal });

    // 8% Ref Logic
    if (userData.referredBy) {
        const bonus = amt * 0.08;
        const refUidSnap = await get(ref(db, 'usernames/' + userData.referredBy));
        if (refUidSnap.exists()) {
            const rUid = refUidSnap.val();
            const rRef = ref(db, 'users/' + rUid);
            const rSnap = await get(rRef);
            if (rSnap.exists()) {
                update(rRef, { 
                    balance: (rSnap.val().balance || 0) + bonus,
                    refEarnings: (rSnap.val().refEarnings || 0) + bonus
                });
            }
        }
    }
}

// REF SYSTEM
window.applyRef = async function() {
    const code = document.getElementById('ref-input').value.trim();
    if (!code || code === myUsername) return tg.showAlert("Invalid Code");
    if (userData.referredBy) return tg.showAlert("Referral already applied!");

    const check = await get(ref(db, 'usernames/' + code));
    if (check.exists()) {
        await update(ref(db, 'users/' + uid), { referredBy: code });
        tg.showAlert("Referrer Linked!");
    } else {
        tg.showAlert("User not found!");
    }
};

// WITHDRAWAL
window.submitWD = function() {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const gnum = document.getElementById('wd-num').value;
    if (amt < 1.0 || isNaN(amt)) return tg.showAlert("Min payout is ₱1.00");
    if (amt > userData.balance) return tg.showAlert("Insufficient balance");

    const key = push(ref(db, 'withdrawals')).key;
    update(ref(db, 'users/' + uid), { balance: userData.balance - amt });
    set(ref(db, 'withdrawals/' + key), {
        userId: uid, name: myUsername, amount: amt, gcash: gnum, status: "Pending", time: new Date().toLocaleString()
    });
    tg.showAlert("Success! Awaiting Admin Approval.");
};

// ADMIN DASHBOARD
window.loginAdmin = function() {
    if (document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        onValue(ref(db, 'withdrawals'), (snap) => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            snap.forEach(c => {
                const w = c.val();
                if(w.status === "Pending") {
                    list.innerHTML += `
                    <div class="glass-card p-3">
                        <p>USER: ${w.name} | GCASH: ${w.gcash}</p>
                        <p class="text-yellow-500 font-bold">₱${w.amount}</p>
                        <div class="flex gap-2 mt-2">
                            <button onclick="admAct('${c.key}', 'Approved')" class="bg-green-600 px-4 py-1 rounded">Approve</button>
                            <button onclick="admDeny('${c.key}', '${w.userId}', ${w.amount})" class="bg-red-600 px-4 py-1 rounded">Deny & Refund</button>
                        </div>
                    </div>`;
                }
            });
        });
    }
};

window.admAct = (key, stat) => update(ref(db, 'withdrawals/' + key), { status: stat });
window.admDeny = async (key, u, a) => {
    const snap = await get(ref(db, 'users/' + u));
    if(snap.exists()) update(ref(db, 'users/' + u), { balance: snap.val().balance + a });
    update(ref(db, 'withdrawals/' + key), { status: "Denied/Refunded" });
};

// UI UTILS
window.showSection = (id) => {
    document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id + '-sec').classList.remove('hidden');
    if(id === 'chat') syncChat();
    if(id === 'wallet') syncHistory();
};

function syncChat() {
    onValue(query(ref(db, 'chats'), limitToLast(15)), (snap) => {
        const box = document.getElementById('chat-msgs'); box.innerHTML = "";
        snap.forEach(c => { box.innerHTML += `<div><b class="text-yellow-500">@${c.val().name}:</b> ${c.val().msg}</div>`; });
        box.scrollTop = box.scrollHeight;
    });
}

function syncHistory() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const h = document.getElementById('wd-history'); h.innerHTML = "";
        snap.forEach(c => {
            if(c.val().userId === uid) {
                h.innerHTML += `<div class="glass-card p-3 flex justify-between text-[10px]">
                    <span>₱${c.val().amount} (${c.val().time})</span>
                    <span class="text-yellow-500">${c.val().status}</span>
                </div>`;
            }
        });
    });
}

function loopCooldowns() {
    setInterval(() => {
        const now = Date.now();
        const m = Math.max(0, Math.ceil((cds.main - now)/1000));
        const p = Math.max(0, Math.ceil((cds.pop - now)/1000));
        const c = Math.max(0, Math.ceil((cds.chat - now)/1000));
        
        document.getElementById('main-cd').innerText = m > 0 ? `Wait ${m}s` : "";
        document.getElementById('pop-cd').innerText = p > 0 ? `Wait ${p}s` : "";
        document.getElementById('chat-cd').innerText = c > 0 ? `Ad Boost Ready in ${c}s` : "Ad Boost Ready!";
        document.getElementById('main-ad-btn').disabled = m > 0;
        document.getElementById('pop-ad-btn').disabled = p > 0;
    }, 1000);
}

init();
