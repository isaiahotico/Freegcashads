
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, query, orderByChild, limitToLast, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const tg = window.Telegram.WebApp;
tg.expand();

// STICKY USER ID FIX: Uses Telegram ID or Unique Local ID
const userId = tg.initDataUnsafe?.user?.id?.toString() || localStorage.getItem('unique_browser_id') || 'guest_' + Math.random().toString(36).substr(2, 9);
if(!tg.initDataUnsafe?.user?.id) localStorage.setItem('unique_browser_id', userId);

const username = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || "User_" + userId.slice(-4);

const zones = ['10276123', '10337795', '10337853'];
const rewardMessages = [
    "💰 Ka-ching! 0.0065 added!", "🚀 To the moon! Earned!", "💎 Diamond hands! Success!",
    "🔥 You're on fire!", "🎖 PaperHouse reward credited!", "🌟 Brilliant work!",
    "💸 Money in the bank!", "⚡ Lightning fast earning!", "🌈 Pure gold!",
    "🏆 Champion level reward!", "🎯 Bullseye! ₱0.0065!", "🥂 Cheers to your earnings!",
    "🦾 Unstoppable!", "👑 King of Ads!", "🦁 Brave earner!",
    "🧨 Explosive growth!", "🍀 Lucky you!", "🛰 Satellite earning!",
    "🛸 Out of this world!", "🎈 Popping rewards!", "🕹 Level up!",
    "🧬 DNA of a winner!", "🍿 Popcorn & Profits!", "⚓ Anchored in wealth!",
    "⛰ Peak performance!", "🌋 Volcanic earnings!", "🌌 Galactic credits!",
    "🎭 Master earner!", "🥊 Knockout reward!", "🎸 Rocking it!",
    "🚲 Keep rolling!", "🛡 Protected profits!", "🏹 Targeted success!",
    "🎨 Artistic earning!", "🎹 Harmony in wealth!", "♟ Strategic win!",
    "🧊 Ice cold cash!", "🌞 Sunny days ahead!", "🌙 Night owl profits!",
    "🔋 Fully charged!"
];

// Start App
initUser();
checkStartupAds();

async function initUser() {
    const userRef = ref(db, 'users/' + userId);
    const snap = await get(userRef);
    
    if (!snap.exists()) {
        const urlParams = new URLSearchParams(window.location.search);
        const refBy = urlParams.get('start');
        await set(userRef, {
            uid: userId, username, balance: 0, ads: 0, 
            refBy: (refBy && refBy !== userId) ? refBy : null,
            lastSeen: Date.now()
        });
        if(refBy && refBy !== userId) update(ref(db, `users/${refBy}`), { refCount: increment(1) });
    }

    onValue(userRef, (s) => {
        const d = s.val();
        document.getElementById('user-balance').innerText = (d.balance || 0).toFixed(4);
        document.getElementById('stat-ads').innerText = d.ads || 0;
        document.getElementById('display-name').innerText = d.username;
        document.getElementById('my-ref-id').innerText = userId;
    });

    loadChat();
    loadHistory();
    loadLeaderboard();
}

// 5-Minute Startup Interstitials
function checkStartupAds() {
    const lastShow = localStorage.getItem('last_interstitial');
    const now = Date.now();
    if (!lastShow || now - lastShow > 300000) { // 5 mins
        zones.forEach((zone, index) => {
            setTimeout(() => {
                const showFn = window['show_' + zone];
                if(typeof showFn === 'function') showFn({ type: 'inApp' });
            }, index * 5000); // 5-sec delay between them
        });
        localStorage.setItem('last_interstitial', now);
    }
}

// Watch Ad Logic (Random Type & Random Zone)
window.watchRandomAd = () => {
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const type = Math.random() > 0.5 ? 'pop' : null; // Randomly choose Popup or Interstitial
    const showFn = window['show_' + zone];

    if (typeof showFn === 'function') {
        showFn(type).then(() => creditReward()).catch(e => tg.showAlert("Ad not ready yet."));
    }
};

async function creditReward() {
    const reward = 0.0065;
    const refBonus = reward * 0.08;
    
    const userRef = ref(db, 'users/' + userId);
    const snap = await get(userRef);
    const data = snap.val();

    await update(userRef, {
        balance: increment(reward),
        ads: increment(1),
        lastSeen: Date.now()
    });

    if (data.refBy) {
        update(ref(db, `users/${data.refBy}`), {
            balance: increment(refBonus),
            refEarnings: increment(refBonus)
        });
    }

    tg.showPopup({
        title: '🎖 REWARD RECEIVED 🎖',
        message: rewardMessages[Math.floor(Math.random() * rewardMessages.length)],
        buttons: [{type: 'ok'}]
    });
}

// Chat System (As requested)
window.sendMessage = () => {
    const text = document.getElementById('chat-input').value;
    if (!text) return;
    push(ref(db, 'chat'), {
        user: username,
        uid: userId,
        msg: text,
        timestamp: Date.now()
    });
    document.getElementById('chat-input').value = '';
};

function loadChat() {
    onValue(query(ref(db, 'chat'), limitToLast(20)), (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = '';
        snapshot.forEach(child => {
            const data = child.val();
            chatBox.innerHTML += `
                <div class="bg-white/5 p-2 rounded-xl">
                    <span class="text-cyan-400 text-[10px] font-bold cursor-pointer" onclick="viewUser('${data.uid}')">@${data.user}:</span> 
                    <p class="text-sm text-gray-200">${data.msg}</p>
                </div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// History Logic (As requested)
function loadHistory() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const list = document.getElementById('history-list');
        list.innerHTML = "";
        let hasData = false;
        snap.forEach(child => {
            const w = child.val();
            if (w.uid === userId) {
                hasData = true;
                const date = new Date(w.timestamp).toLocaleDateString();
                list.innerHTML += `
                    <div class="glass p-4 rounded-xl flex justify-between items-center border-l-4 ${w.status === 'paid' ? 'border-green-500' : 'border-yellow-500'}">
                        <div>
                            <p class="text-sm font-bold">₱${w.amount.toFixed(4)}</p>
                            <p class="text-[10px] text-slate-500">${date}</p>
                        </div>
                        <span class="text-[10px] uppercase font-black ${w.status === 'paid' ? 'text-green-500' : 'text-yellow-500'}">${w.status}</span>
                    </div>`;
            }
        });
        if (!hasData) list.innerHTML = `<p class="text-center text-slate-500 py-10 text-xs">No history yet.</p>`;
    });
}

// Global functions
window.viewUser = async (uid) => {
    const s = await get(ref(db, 'users/' + uid));
    if(!s.exists()) return;
    const u = s.val();
    const isOnline = (Date.now() - u.lastSeen < 300000);
    document.getElementById('m-name').innerText = u.username;
    document.getElementById('m-ads').innerText = u.ads;
    document.getElementById('m-bal').innerText = "₱" + (u.balance || 0).toFixed(4);
    document.getElementById('m-online').innerText = isOnline ? "Online Now" : "Seen 5 minutes ago";
    document.getElementById('user-modal').classList.remove('hidden');
};

window.requestWithdraw = async () => {
    const num = document.getElementById('gcash-num').value;
    const s = await get(ref(db, 'users/' + userId));
    const bal = s.val().balance;
    if(bal < 0.02) return tg.showAlert("Need at least ₱0.02");
    if(num.length < 10) return tg.showAlert("Invalid GCash Number");

    const key = push(ref(db, 'withdrawals')).key;
    await update(ref(db, `withdrawals/${key}`), {
        uid: userId, username, gcash: num, amount: bal, status: 'pending', timestamp: Date.now()
    });
    await update(ref(db, `users/${userId}`), { balance: 0 });
    tg.showAlert("Withdrawal Request Sent!");
};

window.showPage = (id) => {
    document.querySelectorAll('.page-section').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + id).classList.remove('hidden');
    toggleSidebar(false);
};

window.toggleSidebar = (force) => {
    document.getElementById('sidebar').classList.toggle('active', force);
};

window.adminLogin = () => {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        showPage('admin-dashboard');
        onValue(ref(db, 'withdrawals'), snap => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            snap.forEach(c => {
                const w = c.val();
                if(w.status === 'pending') {
                    list.innerHTML += `<div class="glass p-4 rounded text-xs">
                        ${w.username} | ${w.gcash} | ₱${w.amount.toFixed(4)}
                        <button onclick="approve('${c.key}')" class="bg-green-600 p-1 rounded ml-2">Paid</button>
                    </div>`;
                }
            });
        });
    }
};
window.approve = (key) => update(ref(db, `withdrawals/${key}`), {status: 'paid'});
window.closeUserModal = () => document.getElementById('user-modal').classList.add('hidden');

function loadLeaderboard() {
    onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), (snap) => {
        const lb = document.getElementById('leaderboard-list');
        lb.innerHTML = '';
        let users = [];
        snap.forEach(c => users.push(c.val()));
        users.reverse().forEach((u, i) => {
            lb.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-sm">
                <span>${i+1}. ${u.username}</span>
                <span class="text-yellow-500 font-bold">₱${(u.balance || 0).toFixed(4)}</span>
            </div>`;
        });
    });
}
