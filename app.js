
// CONFIGURATION
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
const tg = window.Telegram.WebApp;
tg.expand();

let userId = tg.initDataUnsafe.user?.id || "dev_test_user";
let userName = tg.initDataUnsafe.user?.username || "Guest";
let userData = {};

// 1. Initialize User & Daily/Weekly Stats Logic
function initApp() {
    db.ref('users/' + userId).on('value', (snap) => {
        if (!snap.exists()) {
            db.ref('users/' + userId).set({
                id: userId,
                username: userName,
                balance: 0,
                totalEarned: 0,
                referrals: 0,
                referredBy: "",
                ads_day: 0,
                ads_week: 0,
                ads_overall: 0,
                lastAd1: 0, lastAd2: 0, lastAd3: 0,
                lastChat: 0,
                lastWeeklyReset: Date.now()
            });
        } else {
            userData = snap.val();
            updateGlobalUI();
        }
    });
    
    // Initial Interstitial
    setTimeout(() => triggerInterstitial(), 2000);
}

// 2. Navigation & UI
function showTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'leaderboard') syncLeaderboard();
    if (id === 'chat') syncChat();
    if (id === 'profile') showMyProfile();
}

function updateGlobalUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(2);
    document.getElementById('tg-name').innerText = "@" + userData.username;
}

// 3. Reward & Ads Logic (Fixed Credit Logic)
function handleAd(type) {
    const now = Date.now();
    const config = {
        1: { reward: 0.02, cd: 5*60000, key: 'lastAd1' },
        2: { reward: 0.01, cd: 2*60000, key: 'lastAd2' },
        3: { reward: 0.05, cd: 10*60000, key: 'lastAd3' }
    };
    const c = config[type];
    if (now - userData[c.key] < c.cd) return alert("Cooldown active!");

    show_10276123('pop').then(() => {
        applyReward(c.reward, c.key);
    }).catch(() => applyReward(c.reward, c.key)); // Fallback for dev testing
}

function applyReward(amount, adKey) {
    const updates = {};
    updates[`users/${userId}/balance`] = firebase.database.ServerValue.increment(amount);
    updates[`users/${userId}/totalEarned`] = firebase.database.ServerValue.increment(amount);
    updates[`users/${userId}/ads_day`] = firebase.database.ServerValue.increment(1);
    updates[`users/${userId}/ads_week`] = firebase.database.ServerValue.increment(1);
    updates[`users/${userId}/ads_overall`] = firebase.database.ServerValue.increment(1);
    updates[`users/${userId}/${adKey}`] = Date.now();
    
    db.ref().update(updates).then(() => {
        playRewardAnimation();
        // Referral 10%
        if (userData.referredBy) {
            db.ref(`users/${userData.referredBy}/balance`).transaction(b => (b || 0) + (amount * 0.10));
        }
    });
}

// 4. Enhanced Chat System (Paginated 50k Limit)
function syncChat() {
    db.ref('chats').orderByChild('timestamp').limitToLast(50).on('value', snap => {
        let html = "";
        snap.forEach(child => {
            const m = child.val();
            const isMe = m.uid === userId;
            html += `<div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-2">
                <div class="${isMe ? 'bg-cyan-600' : 'bg-slate-700'} chat-bubble" onclick="viewPublicProfile('${m.uid}')">
                    <p class="text-[9px] font-bold opacity-70">${m.name}</p>
                    <p>${m.text}</p>
                </div>
            </div>`;
        });
        const box = document.getElementById('chat-box');
        box.innerHTML = html;
        box.scrollTop = box.scrollHeight;
    });
}

async function sendChatMessage() {
    const now = Date.now();
    if (now - userData.lastChat < 240000) return alert("Chat cooldown: 4 minutes");
    
    const text = document.getElementById('msg-input').value;
    if (!text) return;

    // Trigger 3 Inline Ads Reward
    alert("Watching Ad verification to send...");
    show_10276123('pop').then(() => {
        db.ref('chats').push({
            uid: userId,
            name: userName,
            text: text,
            timestamp: now
        });
        applyReward(0.02, 'lastChat');
        document.getElementById('msg-input').value = "";
    });
}

// 5. Profile & Public View System
function showMyProfile() {
    const p = userData;
    document.getElementById('profile-view').innerHTML = `
        <div class="text-center">
            <div class="w-20 h-20 bg-cyan-500 rounded-full mx-auto mb-2 flex items-center justify-center text-3xl">💎</div>
            <h2 class="text-xl font-black italic">@${p.username}</h2>
            <p class="text-xs text-cyan-400 mb-4">Total Referrals: ${p.referrals || 0}</p>
            
            <div class="grid grid-cols-3 gap-2 mb-6">
                <div class="bg-slate-800 p-2 rounded-xl"><p class="text-[10px]">DAILY</p><p class="font-bold">${p.ads_day}</p></div>
                <div class="bg-slate-800 p-2 rounded-xl"><p class="text-[10px]">WEEKLY</p><p class="font-bold">${p.ads_week}</p></div>
                <div class="bg-slate-800 p-2 rounded-xl"><p class="text-[10px]">OVERALL</p><p class="font-bold">${p.ads_overall}</p></div>
            </div>
            
            <button onclick="copyRef()" class="w-full bg-slate-700 py-3 rounded-xl text-sm mb-2">Copy Referral Code</button>
            <p class="text-[10px] opacity-50">UID: ${userId}</p>
        </div>
    `;
}

window.viewPublicProfile = function(uid) {
    db.ref('users/' + uid).once('value', snap => {
        const p = snap.val();
        alert(`User: @${p.username}\nOverall Ads: ${p.ads_overall}\nTotal Earned: ₱${p.totalEarned.toFixed(2)}`);
    });
};

// 6. Leaderboard (Sync Every Second)
function syncLeaderboard() {
    db.ref('users').orderByChild('ads_overall').limitToLast(50).on('value', snap => {
        let players = [];
        snap.forEach(c => players.push(c.val()));
        players.reverse();
        
        let html = "";
        players.forEach((p, i) => {
            html += `<div class="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border-l-4 ${i<3?'border-yellow-500':'border-transparent'}">
                <div class="flex items-center gap-3">
                    <span class="font-bold text-cyan-400">#${i+1}</span>
                    <span class="text-sm">${p.username}</span>
                </div>
                <span class="font-bold text-green-400">₱${p.totalEarned.toFixed(2)}</span>
            </div>`;
        });
        document.getElementById('leader-table').innerHTML = html;
    });
}

// 7. Animations & Theme
const themes = ['pink','green','blue','red','violet','yellow','orange','white','cyan','brown'];
function changeAppTheme() {
    const randomColor = themes[Math.floor(Math.random() * themes.length)];
    document.body.style.setProperty('--bg-color', randomColor);
    document.getElementById('side-trigger').style.color = 'white';
}

function playRewardAnimation() {
    const anims = ['animate__bounceIn', 'animate__backInDown', 'animate__zoomInDown', 'animate__flipInX', 'animate__jackInTheBox'];
    const selected = anims[Math.floor(Math.random() * anims.length)];
    const el = document.getElementById('reward-anim-container');
    el.innerHTML = `<div class="animate__animated ${selected} bg-yellow-400 text-black px-8 py-4 rounded-3xl font-black shadow-2xl border-4 border-white text-center">
        <p class="text-2xl">💰 REWARDED! 💰</p>
        <p class="text-sm">+ ₱0.02 ADDED</p>
    </div>`;
    setTimeout(() => el.innerHTML = "", 3000);
}

// 8. Admin System
function authAdmin() {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-gate').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        syncAdminData();
    }
}

function syncAdminData() {
    db.ref('withdrawals').on('value', snap => {
        let html = "";
        snap.forEach(c => {
            const w = c.val();
            html += `<div class="bg-slate-800 p-3 rounded-xl mb-2 flex justify-between">
                <div><p class="font-bold">${w.gcash}</p><p class="text-xs">₱${w.amount}</p></div>
                <button onclick="approve('${c.key}')" class="bg-green-600 px-3 rounded-lg">PAID</button>
            </div>`;
        });
        document.getElementById('admin-withdrawals').innerHTML = html;
    });
}

// 9. Monetag Interstitial Manager
function triggerInterstitial() {
    const last = localStorage.getItem('last_interstitial') || 0;
    if (Date.now() - last > 180000) {
        show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, timeout: 0 } });
        localStorage.setItem('last_interstitial', Date.now());
    }
}

function withdraw() {
    const g = document.getElementById('gcash').value;
    if (userData.balance < 1) return alert("Min ₱1");
    if (g.length < 10) return alert("Valid GCash only");
    
    db.ref('withdrawals').push({
        uid: userId,
        amount: userData.balance,
        gcash: g,
        status: 'pending'
    });
    db.ref(`users/${userId}/balance`).set(0);
    alert("Withdrawal submitted!");
}

// Launch
initApp();
