
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

// Telegram & User State
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || { id: "0000", first_name: "LocalUser", username: "Guest" };
const uid = user.id.toString();
const myUsername = user.username || `user_${uid}`;

let userData = { balance: 0, refEarnings: 0 };
let cds = { main: 0, pop: 0, chat: 0 };

async function startApp() {
    tg.expand();
    document.getElementById('user-tag').innerText = myUsername;
    document.getElementById('my-code-display').innerText = myUsername;

    const uRef = ref(db, 'users/' + uid);
    const snap = await get(uRef);
    if(!snap.exists()) {
        await set(uRef, { name: user.first_name, username: myUsername, balance: 0, refEarnings: 0, referredBy: null });
        await set(ref(db, 'usernames/' + myUsername), uid);
    }

    onValue(uRef, (s) => {
        userData = s.val();
        document.getElementById('bal').innerText = userData.balance.toFixed(4);
        document.getElementById('ref-bonus-total').innerText = (userData.refEarnings || 0).toFixed(4);
    });

    // In-App Interstitial: On Open
    showInApp();
    // Every 4 minutes
    setInterval(showInApp, 240000);

    initAds();
    loopCooldowns();
}

// --- ADS LOGIC ---
function showInApp() {
    show_10276123({
        type: 'inApp',
        inAppSettings: { frequency: 1, capping: 0, interval: 0, timeout: 0, everyPage: false }
    });
}

function initAds() {
    // Popunder - 1 Hour
    setInterval(() => {
        const s = document.createElement('script');
        s.dataset.zone = '10049581';
        s.src = 'https://al5sm.com/tag.min.js';
        document.body.appendChild(s);
    }, 3600000);

    // Native Ad - 30 Minutes
    const loadNative = () => {
        const container = document.getElementById('native-container');
        container.innerHTML = "";
        const s = document.createElement('script');
        s.dataset.zone = '10109465'; s.src = 'https://groleegni.net/vignette.min.js';
        container.appendChild(s);
    };
    loadNative();
    setInterval(loadNative, 1800000);
}

window.watchMainAd = function() {
    if (Date.now() < cds.main) return;
    show_10276123().then(() => {
        reward(0.01);
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

window.sendChat = async function() {
    if (Date.now() < cds.chat) return tg.showAlert("Chat cooldown active!");
    const msg = document.getElementById('chat-in').value;
    if(!msg) return;

    tg.showConfirm("Watch 3 Ads to send message & earn ₱0.0186?", async (ok) => {
        if(ok) {
            await show_10276123(); // Interstitial 1
            await show_10276123(); // Interstitial 2
            await show_10276123(); // Interstitial 3
            reward(0.0186);
            push(ref(db, 'chats'), { name: myUsername, msg, time: serverTimestamp() });
            document.getElementById('chat-in').value = "";
            cds.chat = Date.now() + 180000;
        }
    });
};

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

// --- REFERRAL SYSTEM ---
window.applyReferral = async function() {
    const code = document.getElementById('ref-code-input').value.trim();
    if (!code || code === myUsername) return tg.showAlert("Invalid code");
    if (userData.referredBy) return tg.showAlert("Referral already applied!");

    const checkCode = await get(ref(db, 'usernames/' + code));
    if (checkCode.exists()) {
        await update(ref(db, 'users/' + uid), { referredBy: code });
        tg.showAlert("Referrer Sync Successful!");
    } else {
        tg.showAlert("User not found!");
    }
};

// --- WITHDRAWAL & ADMIN ---
window.requestPayout = function() {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const num = document.getElementById('wd-num').value;
    if (amt < 1.0) return tg.showAlert("Min payout is ₱1.00");
    if (amt > userData.balance) return tg.showAlert("Insufficient balance");

    const key = push(ref(db, 'withdrawals')).key;
    update(ref(db, 'users/' + uid), { balance: userData.balance - amt });
    set(ref(db, 'withdrawals/' + key), {
        userId: uid, name: myUsername, amount: amt, gcash: num, status: "Pending", time: new Date().toLocaleString()
    });
    tg.showAlert("Payout Request Submitted!");
};

window.authAdmin = function() {
    if (document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        onValue(ref(db, 'withdrawals'), (snap) => {
            const list = document.getElementById('admin-requests');
            list.innerHTML = "";
            snap.forEach(c => {
                const w = c.val();
                if(w.status === "Pending") {
                    list.innerHTML += `
                    <div class="glass-card p-3">
                        <p>USER: ${w.name} | GCASH: ${w.gcash}</p>
                        <p class="text-yellow-500 font-bold">₱${w.amount}</p>
                        <div class="flex gap-2 mt-2">
                            <button onclick="approve('${c.key}')" class="bg-green-600 px-4 py-1 rounded">Approve</button>
                            <button onclick="deny('${c.key}', '${w.userId}', ${w.amount})" class="bg-red-600 px-4 py-1 rounded">Deny</button>
                        </div>
                    </div>`;
                }
            });
        });
    }
};

window.approve = (key) => update(ref(db, 'withdrawals/' + key), { status: "Approved" });
window.deny = async (key, userId, amt) => {
    const uRef = ref(db, 'users/' + userId);
    const s = await get(uRef);
    if(s.exists()) update(uRef, { balance: s.val().balance + amt });
    update(ref(db, 'withdrawals/' + key), { status: "Denied/Refunded" });
};

// --- UI LOOP ---
function loopCooldowns() {
    setInterval(() => {
        const now = Date.now();
        const m = Math.max(0, Math.ceil((cds.main - now)/1000));
        const p = Math.max(0, Math.ceil((cds.pop - now)/1000));
        const c = Math.max(0, Math.ceil((cds.chat - now)/1000));
        
        document.getElementById('main-cd').innerText = m > 0 ? `Wait ${m}s` : "";
        document.getElementById('pop-cd').innerText = p > 0 ? `Wait ${p}s` : "";
        document.getElementById('chat-cd').innerText = c > 0 ? `Boost Ready in ${c}s` : "Boost Ready!";
        document.getElementById('main-ad-btn').disabled = m > 0;
        document.getElementById('pop-ad-btn').disabled = p > 0;
    }, 1000);
}

window.showSection = (id) => {
    document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id + '-sec').classList.remove('hidden');
    if(id === 'chat') {
        onValue(query(ref(db, 'chats'), limitToLast(15)), (snap) => {
            const box = document.getElementById('chat-msgs'); box.innerHTML = "";
            snap.forEach(c => { box.innerHTML += `<div><b class="text-yellow-500">@${c.val().name}:</b> ${c.val().msg}</div>`; });
            box.scrollTop = box.scrollHeight;
        });
    }
    if(id === 'ref') {
        onValue(ref(db, 'withdrawals'), (snap) => {
            const list = document.getElementById('wd-history'); list.innerHTML = "";
            snap.forEach(c => {
                const w = c.val();
                if(w.userId === uid) {
                    list.innerHTML += `<div class="glass-card p-3 flex justify-between text-[10px]">
                        <span>₱${w.amount} (${w.time})</span>
                        <span class="${w.status === 'Approved' ? 'text-green-500' : 'text-yellow-500'}">${w.status}</span>
                    </div>`;
                }
            });
        });
    }
};

startApp();
