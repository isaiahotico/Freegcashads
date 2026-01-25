
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

// Telegram Init
const tg = window.Telegram.WebApp;
const tgUser = tg.initDataUnsafe?.user || { id: "12345", first_name: "Local", username: "GuestUser" };
const userId = tgUser.id.toString();
const myUsername = tgUser.username || `user_${userId}`;

let userData = { balance: 0, totalRefEarnings: 0 };
let cooldowns = { main: 0, pop: 0, chat: 0 };

// 1. App Startup
async function init() {
    document.getElementById('display-username').innerText = myUsername;
    const botUser = "PaperhouseIncAdsBot"; // Replace with your real bot username
    document.getElementById('ref-link').innerText = `https://t.me/${botUser}/start?startapp=${myUsername}`;

    // Handle Referral logic
    const params = new URLSearchParams(window.location.search);
    const referrerUsername = params.get('tgWebAppStartParam');

    const userRef = ref(db, 'users/' + userId);
    const snap = await get(userRef);

    if (!snap.exists()) {
        const newUser = {
            name: tgUser.first_name,
            username: myUsername,
            balance: 0,
            totalRefEarnings: 0,
            referredBy: referrerUsername || null
        };
        await set(userRef, newUser);
        await set(ref(db, 'usernames/' + myUsername), userId);
    }

    onValue(userRef, (s) => {
        userData = s.val();
        document.getElementById('user-balance').innerText = userData.balance.toFixed(4);
        document.getElementById('total-ref-earn').innerText = (userData.totalRefEarnings || 0).toFixed(4);
    });

    startGlobalAds();
    updateCooldownVisuals();
}

// 2. Ad & Reward Systems
async function giveReward(amount) {
    // 1. Give User Reward
    const newBal = (userData.balance || 0) + amount;
    await update(ref(db, 'users/' + userId), { balance: newBal });

    // 2. Referral 8% Logic
    if (userData.referredBy) {
        const refBonus = amount * 0.08;
        const refIdSnap = await get(ref(db, 'usernames/' + userData.referredBy));
        if (refIdSnap.exists()) {
            const referrerUid = refIdSnap.val();
            const referrerRef = ref(db, 'users/' + referrerUid);
            const rSnap = await get(referrerRef);
            if (rSnap.exists()) {
                const rData = rSnap.val();
                update(referrerRef, {
                    balance: (rData.balance || 0) + refBonus,
                    totalRefEarnings: (rData.totalRefEarnings || 0) + refBonus
                });
            }
        }
    }
}

// Button Ad
window.watchMainAd = function() {
    if (Date.now() < cooldowns.main) return;
    show_10276123().then(() => {
        giveReward(0.01);
        cooldowns.main = Date.now() + 45000;
    });
};

// Quick Pop Ad
window.watchQuickPop = function() {
    if (Date.now() < cooldowns.pop) return;
    show_10276123('pop').then(() => {
        giveReward(0.0095);
        cooldowns.pop = Date.now() + 60000;
    });
};

// Chat Triple Ad Logic
window.sendChatMessage = async function() {
    if (Date.now() < cooldowns.chat) return tg.showAlert("Chat reward cooling down!");
    const msg = document.getElementById('chat-input').value;
    if (!msg) return;

    tg.showConfirm("Watch 3 Interstitial ads to send & earn ₱0.0186?", async (ok) => {
        if (ok) {
            try {
                await show_10276123(); // Ad 1
                await show_10276123(); // Ad 2
                await show_10276123(); // Ad 3
                
                giveReward(0.0186);
                push(ref(db, 'chats'), { 
                    name: myUsername, 
                    msg: msg, 
                    time: serverTimestamp() 
                });
                document.getElementById('chat-input').value = "";
                cooldowns.chat = Date.now() + 180000; // 3 mins
            } catch (e) {
                tg.showAlert("Ad failed. Try again.");
            }
        }
    });
};

// 3. Automated Ad Loops
function startGlobalAds() {
    // Popunder - 1 Hour
    setInterval(() => {
        const s = document.createElement('script');
        s.dataset.zone = '10049581';
        s.src = 'https://al5sm.com/tag.min.js';
        document.body.appendChild(s);
    }, 3600000);

    // Native Ad - 30 Minutes
    const loadNative = () => {
        const slot = document.getElementById('native-slot');
        slot.innerHTML = "";
        const s = document.createElement('script');
        s.dataset.zone = '10109465';
        s.src = 'https://groleegni.net/vignette.min.js';
        slot.appendChild(s);
    };
    loadNative();
    setInterval(loadNative, 1800000);
}

// 4. Withdrawal System
window.submitWithdrawal = function() {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const gcash = document.getElementById('wd-gcash').value;
    if (amt < 1.0) return tg.showAlert("Minimum is ₱1.00");
    if (amt > userData.balance) return tg.showAlert("Insufficient balance");

    const wdKey = push(ref(db, 'withdrawals')).key;
    update(ref(db, 'users/' + userId), { balance: userData.balance - amt });
    set(ref(db, 'withdrawals/' + wdKey), {
        userId, name: myUsername, amount: amt, gcash, status: "Pending", time: new Date().toLocaleString()
    });
    tg.showAlert("Request Sent! Awaiting Admin Approval.");
};

// 5. Admin Dashboard Logic
window.verifyAdmin = function() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        onValue(ref(db, 'withdrawals'), (snap) => {
            const list = document.getElementById('admin-wd-list');
            list.innerHTML = "";
            snap.forEach(child => {
                const w = child.val();
                if (w.status === "Pending") {
                    list.innerHTML += `
                    <div class="glass p-3 rounded">
                        <p>USER: ${w.name} | GCASH: ${w.gcash}</p>
                        <p class="text-yellow-400 font-bold">₱${w.amount}</p>
                        <div class="flex gap-2 mt-2">
                            <button onclick="approveWD('${child.key}')" class="bg-green-600 px-3 py-1 rounded">Approve</button>
                            <button onclick="rejectWD('${child.key}', '${w.userId}', ${w.amount})" class="bg-red-600 px-3 py-1 rounded">Reject</button>
                        </div>
                    </div>`;
                }
            });
        });
    }
};

window.approveWD = (key) => update(ref(db, 'withdrawals/' + key), { status: "Approved" });
window.rejectWD = async (key, uid, amt) => {
    const uRef = ref(db, 'users/' + uid);
    const uSnap = await get(uRef);
    if (uSnap.exists()) {
        update(uRef, { balance: uSnap.val().balance + amt });
    }
    update(ref(db, 'withdrawals/' + key), { status: "Rejected" });
};

// UI Helpers
window.showSection = (id) => {
    document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(id + '-sec').classList.remove('hidden');
    if (id === 'chat') loadChat();
    if (id === 'profile') loadHistory();
};

function loadChat() {
    onValue(query(ref(db, 'chats'), limitToLast(15)), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(c => {
            box.innerHTML += `<div class="p-1"><b class="text-yellow-500">@${c.val().name}:</b> ${c.val().msg}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function loadHistory() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        let h = "";
        snap.forEach(c => {
            if (c.val().userId === userId) {
                const sColor = c.val().status === "Approved" ? "text-green-400" : "text-yellow-500";
                h += `<div class="glass p-3 rounded-xl flex justify-between text-[10px]">
                    <span>₱${c.val().amount} - ${c.val().time}</span>
                    <span class="${sColor}">${c.val().status}</span>
                </div>`;
            }
        });
        document.getElementById('my-history').innerHTML = h || "<p class='text-center text-xs text-slate-600'>Empty</p>";
    });
}

function updateCooldownVisuals() {
    setInterval(() => {
        const now = Date.now();
        const mainDiff = Math.ceil((cooldowns.main - now)/1000);
        const popDiff = Math.ceil((cooldowns.pop - now)/1000);
        const chatDiff = Math.ceil((cooldowns.chat - now)/1000);
        
        document.getElementById('cd-main').innerText = mainDiff > 0 ? `Ready in ${mainDiff}s` : "";
        document.getElementById('cd-pop').innerText = popDiff > 0 ? `Wait ${popDiff}s` : "";
        document.getElementById('cd-chat').innerText = chatDiff > 0 ? `Boost ready in ${chatDiff}s` : "";
        document.getElementById('btn-main-ad').disabled = mainDiff > 0;
        document.getElementById('btn-pop-ad').disabled = popDiff > 0;
    }, 1000);
}

init();
