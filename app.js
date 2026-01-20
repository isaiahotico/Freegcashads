
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, where,
  doc, updateDoc, getDocs, startAfter, getDoc, setDoc, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- User Initialization ---
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user || null;

let currentUser = { 
    uid: 'guest', 
    username: 'Guest',
    tgId: '0' 
};

if (tgUser) {
    currentUser = { 
        uid: String(tgUser.id), 
        username: tgUser.username ? `@${tgUser.username}` : tgUser.first_name,
        tgId: String(tgUser.id)
    };
}

document.getElementById('userBar').innerText = `👤 User: ${currentUser.username}`;
document.getElementById('usernameSmall').innerText = `ID: ${currentUser.uid}`;

// --- User Data and Sync ---
let userData = {};

async function ensureUserDoc() {
    const udoc = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(udoc);

    if (!snap.exists()) {
        const initialData = {
            username: currentUser.username,
            balance: 0,
            totalEarned: 0,
            adsCount: 0,
            dailyAds: 0,
            weeklyAds: 0,
            referrals: [],
            refBonus: 0,
            referredBy: null,
            lastChat: 0,
            createdAt: Date.now()
        };
        await setDoc(udoc, initialData);
        userData = initialData;
    } else {
        userData = snap.data();
    }
}
ensureUserDoc();

// Real-time Balance and Stats Sync
onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();
    userData = d;
    document.getElementById('balanceDisplay').innerText = `₱${(d.balance || 0).toFixed(2)}`;
    document.getElementById('totalEarned').innerText = `₱${(d.totalEarned || 0).toFixed(2)}`;
    document.getElementById('refCount').innerText = (d.referrals || []).length;
    document.getElementById('refBonus').innerText = (d.refBonus || 0).toFixed(2);
    document.getElementById('adsAll').innerText = d.adsCount || 0;
    document.getElementById('adsDay').innerText = d.dailyAds || 0;
    document.getElementById('adsWeek').innerText = d.weeklyAds || 0;
    document.getElementById('gcashBalance').innerText = (d.balance || 0).toFixed(2);
    document.getElementById('faucetBalance').innerText = (d.balance || 0).toFixed(2);
    document.getElementById('profileUsername').innerText = d.username || currentUser.username;
    document.getElementById('profileRefCount').innerText = (d.referrals || []).length;
});

// --- Navigation ---
window.openSection = (id) => {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    if (id === 'withdraw') subscribeWithdrawHistory();
    if (id === 'chat') loadChat();
    if (id === 'profile') loadProfile(currentUser.uid);
    if (id === 'leaders') subscribeLeaderboards();
};

// --- Ad Tasks (Combined Logic) ---
const tasksConfig = [
    { id: 'task_ads1', type: 'adsList', title: '🍍Task #1 (0.025)', zones: ['show_10276123'], reward: 0.025, cooldownSec: 10800 },
    { id: 'task_ads2', type: 'adsList', title: '🍍Task #2 (0.025)', zones: ['show_10337795'], reward: 0.025, cooldownSec: 10800 },
    { id: 'task_gift1', type: 'giftList', title: '🎁 Gift Claim (0.02)', zones: ['show_10337853'], reward: 0.02, cooldownSec: 3600 },
    { id: 'task_signin1', type: 'signinList', title: '✅ Daily Sign In (0.05)', zones: ['show_10276123'], reward: 0.05, cooldownSec: 86400 },
];

function renderAdsUI() {
    document.getElementById('adsList').innerHTML = '';
    document.getElementById('giftList').innerHTML = '';
    document.getElementById('signinList').innerHTML = '';

    tasksConfig.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.innerText = t.title;
        btn.onclick = () => playTask(t);
        document.getElementById(t.type).appendChild(btn);
    });
}
renderAdsUI();

function getCooldownKey(taskId){ return `cd_${currentUser.uid}_${taskId}`; }

async function playTask(task) {
    const last = parseInt(localStorage.getItem(getCooldownKey(task.id)) || '0',10);
    const now = Math.floor(Date.now()/1000);
    if (last && now - last < task.cooldownSec) {
        alert(`Cooldown active. Wait ${Math.ceil((task.cooldownSec - (now-last))/60)} minutes.`);
        return;
    }
    
    try {
        const fn = window[task.zones[0]];
        if (typeof fn === 'function') await fn();
        
        await grantReward(task.reward, `task:${task.id}`);
        localStorage.setItem(getCooldownKey(task.id), String(now));
        triggerRewardPopup();
    } catch (e) {
        alert('Ad error or closed early.');
    }
}

async function grantReward(amountPeso, reason='ads') {
    const uRef = doc(db, 'users', currentUser.uid);
    
    await updateDoc(uRef, {
        balance: increment(amountPeso),
        totalEarned: increment(amountPeso),
        adsCount: increment(1),
        dailyAds: increment(1),
        weeklyAds: increment(1),
    });
    
    if (userData.referredBy) {
        const bonus = +(amountPeso * 0.10).toFixed(4);
        const refUserRef = doc(db, 'users', userData.referredBy);
        await updateDoc(refUserRef, {
             refBonus: increment(bonus) 
        });
    }
}

const rewardAnims = ['animate__bounceIn','animate__jackInTheBox','animate__zoomInDown','animate__rollIn','animate__backInDown'];
function triggerRewardPopup(){
    const modal = document.createElement('div');
    modal.className = `modal`;
    const box = document.createElement('div');
    box.className = 'box animate__animated ' + rewardAnims[Math.floor(Math.random()*rewardAnims.length)];
    box.innerHTML = `<h2>🎉 Congratulations! 🎉</h2><p>You earned a reward!</p><div style="text-align:right;"><button class="btn" onclick="this.closest('.modal').remove()">OK</button></div>`;
    document.body.appendChild(modal);
    modal.appendChild(box);
}

// --- Withdrawal ---
async function requestWithdraw(method) {
    const amountInput = method === 'gcash' ? document.getElementById('gcashAmount') : document.getElementById('faucetAmount');
    const dest = method === 'gcash' ? document.getElementById('gcashNumber').value.trim() : document.getElementById('faucetEmail').value.trim();
    const amount = parseFloat(amountInput.value);

    if (!dest || isNaN(amount) || amount <= 0 || amount > userData.balance) { 
        return alert("Invalid amount or insufficient balance."); 
    }

    let amountUSDT = null;
    if (method === 'faucet') {
        const rate = 56.0; 
        amountUSDT = +(amount / rate).toFixed(6);
    }

    // Deduct balance immediately (reserve). Note: Processing must be done manually by the owner.
    await updateDoc(doc(db, 'users', currentUser.uid), { balance: increment(-amount) });

    await addDoc(collection(db, 'withdrawals'), {
        userId: currentUser.uid,
        username: currentUser.username,
        method, dest,
        amountPeso: amount,
        amountUSDT: amountUSDT,
        status: 'pending',
        createdAt: Date.now()
    });

    alert('Withdrawal Requested! Processing is manual.');
    amountInput.value = '';
}

let withdrawLastDoc = null;
let withdrawPageSize = 10;

function subscribeWithdrawHistory() {
    const q = query(collection(db, 'withdrawals'), where('userId','==', currentUser.uid), orderBy('createdAt','desc'), limit(withdrawPageSize));
    onSnapshot(q, (snap) => {
        let html = '<table><tr><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr>';
        snap.forEach(d => {
            const w = d.data();
            const date = new Date(w.createdAt).toLocaleDateString();
            html += `<tr><td>${w.method}</td><td>₱${w.amountPeso.toFixed(2)}</td><td class="status-${w.status}">${w.status}</td><td>${date}</td></tr>`;
        });
        document.getElementById('withdrawHistory').innerHTML = html + '</table>';
        withdrawLastDoc = snap.docs[snap.docs.length-1] || null;
    });
}

window.paginateWithdraw = async (dir) => {
    alert("Pagination not fully implemented in this demo.");
}

// --- Referrals ---
window.setReferral = async () => {
    const refInput = document.getElementById('referralInput').value.trim().replace('@','');
    if (!refInput) return alert('Enter username');
    
    const q = query(collection(db, 'users'), where('username','==', '@' + refInput), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return alert('Referrer not found.');
    const refUserDoc = snap.docs[0];
    
    await updateDoc(doc(db, 'users', currentUser.uid), { referredBy: refUserDoc.id });
    await updateDoc(refUserDoc.ref, { referrals: [...(refUserDoc.data().referrals || []), currentUser.uid] });
    
    alert('Referrer set successfully!');
};

window.claimReferralBonus = async () => {
    if (userData.refBonus <= 0) return alert('No claimable bonus.');
    
    const amount = userData.refBonus;
    const uRef = doc(db, 'users', currentUser.uid);
    
    await updateDoc(uRef, {
        balance: increment(amount),
        refBonus: 0
    });
    alert(`Claimed ₱${amount.toFixed(2)} bonus!`);
};


// --- Chat ---
window.sendChatMessage = async () => {
    const input = document.getElementById('chatInput');
    if (!input.value.trim()) return;
    
    if (Date.now() - (userData.lastChat || 0) < 4 * 60 * 1000) {
        return alert('Cooldown: 4 minutes between messages.');
    }

    try {
        const ads = ['show_10276123','show_10337795','show_10337853'];
        const fn = window[ads[Math.floor(Math.random()*ads.length)]];
        if (typeof fn === 'function') await fn();

        await addDoc(collection(db, 'messages'), {
            userId: currentUser.uid,
            username: currentUser.username,
            text: input.value.trim(),
            ts: serverTimestamp()
        });

        await grantReward(0.02, 'chat_message');
        await updateDoc(doc(db, 'users', currentUser.uid), { lastChat: Date.now() });
        input.value = '';
    } catch (e) {
        alert('Ad failed or network error.');
    }
};

function loadChat() {
    const q = query(collection(db, 'messages'), orderBy('ts','desc'), limit(10));
    onSnapshot(q, (snap) => {
        const chatDiv = document.getElementById('chatMessages');
        chatDiv.innerHTML = '';
        snap.docs.slice().reverse().forEach(d => {
            const data = d.data();
            const el = document.createElement('div');
            el.innerHTML = `<strong><span class="link" onclick="loadProfile('${data.userId}')">${data.username}</span></strong>: ${data.text}`;
            chatDiv.appendChild(el);
        });
        chatDiv.scrollTop = chatDiv.scrollHeight;
    });
}

// --- Profile and Leaderboards ---
window.loadProfile = async (targetUid) => {
    const snap = await getDoc(doc(db, 'users', targetUid));
    if (!snap.exists()) return;
    const d = snap.data();
    
    document.getElementById('profileUsername').innerText = d.username || 'N/A';
    document.getElementById('profileRefCount').innerText = (d.referrals || []).length;
    document.getElementById('adsAll').innerText = d.adsCount || 0;
    document.getElementById('adsDay').innerText = d.dailyAds || 0;
    document.getElementById('adsWeek').innerText = d.weeklyAds || 0;
    
    openSection('profile');
};

window.messageUser = (btn) => {
    alert('Messaging feature requires Telegram deep linking implementation.');
};

function subscribeLeaderboards() {
    const qEarn = query(collection(db, 'users'), orderBy('totalEarned', 'desc'), limit(10));
    onSnapshot(qEarn, (snap) => {
        let html = '<table><tr><th>#</th><th>User</th><th>Earned</th></tr>';
        snap.forEach((d, i) => {
            const data = d.data();
            html += `<tr><td>${i + 1}</td><td><span class="link" onclick="loadProfile('${d.id}')">${data.username}</span></td><td>₱${(data.totalEarned || 0).toFixed(2)}</td></tr>`;
        });
        document.getElementById('leadersTable').innerHTML = html + '</table>';
    });

    const qAds = query(collection(db, 'users'), orderBy('weeklyAds', 'desc'), limit(10));
    onSnapshot(qAds, (snap) => {
        let html = '<table><tr><th>#</th><th>User</th><th>Weekly Ads</th></tr>';
        snap.forEach((d, i) => {
            const data = d.data();
            html += `<tr><td>${i + 1}</td><td><span class="link" onclick="loadProfile('${d.id}')">${data.username}</span></td><td>${data.weeklyAds || 0}</td></tr>`;
        });
        document.getElementById('adsLeadersTable').innerHTML = html + '</table>';
    });
}
// Removed runWeeklyPayout function
