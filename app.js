
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp, startAfter, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Telegram Init
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
const tgUser = tg?.initDataUnsafe?.user || { id: "dev_test", username: "Tester", first_name: "Guest" };
const userId = tgUser.id.toString();
const username = tgUser.username || tgUser.first_name;

let userData = { balance: 0 };
const PHP_USDT_RATE = 0.017;

// Initialize App
window.onload = () => {
    initUser();
    setupAutoAds();
    renderAdTasks();
    renderAdGifts();
    listenToHistory();
};

function setupAutoAds() {
    if (typeof show_10337795 === 'function') {
        show_10337795({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

async function initUser() {
    const urlParams = new URLSearchParams(window.location.search);
    const refBy = urlParams.get('startapp');

    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, {
            username: username,
            balance: 0,
            referredBy: (refBy && refBy !== userId) ? refBy : null,
            refCount: 0,
            createdAt: serverTimestamp()
        });
        if (refBy && refBy !== userId) {
            await updateDoc(doc(db, "users", refBy), { refCount: increment(1) });
        }
    }

    onSnapshot(userRef, (d) => {
        userData = d.data();
        document.getElementById('balance').innerText = userData.balance.toFixed(3);
        document.getElementById('refCount').innerText = userData.refCount || 0;
        document.getElementById('userBar').innerText = `👤 User: @${username}`;
        document.getElementById('refLink').value = `https://t.me/freegcash_ads_bot/app?startapp=${userId}`;
    });
}

// Render Logic
function renderAdTasks() {
    const tasks = [
        { id: 1, zone: '10276123', cd: 5 },
        { id: 2, zone: '10337795', cd: 5 },
        { id: 3, zone: '10337853', cd: 5 }
    ];
    document.getElementById('tasks-container').innerHTML = tasks.map(t => `
        <div class="glass-card text-center">
            <h3 class="font-black text-yellow-400 tracking-tighter italic italic">🤑🍍 TASK #${t.id} 🍍🤑</h3>
            <button id="btn-t${t.id}" onclick="triggerAd('${t.zone}', ${t.id}, 'task')" class="btn-gold">WATCH AD</button>
            <button id="claim-t${t.id}" onclick="claimReward(${t.id}, 'task')" class="btn-gold !bg-green-600 hidden">CLAIM ₱0.02</button>
            <p id="timer-t${t.id}" class="text-[10px] mt-2 text-slate-500 font-mono"></p>
        </div>`).join('');
    tasks.forEach(t => startCooldownUI(t.id, 'task', t.cd));
}

function renderAdGifts() {
    const gifts = [
        { id: 1, zone: '10276123', cd: 120 },
        { id: 2, zone: '10337795', cd: 120 },
        { id: 3, zone: '10337853', cd: 120 }
    ];
    document.getElementById('gifts-container').innerHTML = gifts.map(g => `
        <div class="glass-card text-center">
            <h3 class="font-black text-blue-400 italic italic">🎁 🍍 GIFT #${g.id} 🍍 🎁</h3>
            <button id="btn-g${g.id}" onclick="triggerAd('${g.zone}', ${g.id}, 'gift')" class="btn-gold">OPEN GIFT AD</button>
            <button id="claim-g${g.id}" onclick="claimReward(${g.id}, 'gift')" class="btn-gold !bg-green-600 hidden">CLAIM ₱0.02</button>
            <p id="timer-g${g.id}" class="text-[10px] mt-2 text-slate-500 font-mono"></p>
        </div>`).join('');
    gifts.forEach(g => startCooldownUI(g.id, 'gift', g.cd));
}

// Monetag Ad Triggers
window.triggerAd = (zone, id, type) => {
    const adFn = window[`show_${zone}`];
    const isPop = type === 'gift' ? 'pop' : undefined;

    adFn(isPop).then(() => {
        document.getElementById(`btn-${type[0]}${id}`).classList.add('hidden');
        document.getElementById(`claim-${type[0]}${id}`).classList.remove('hidden');
    }).catch(() => alert("Ad error or closed too early."));
};

window.claimReward = async (id, type) => {
    const reward = 0.02;
    const key = type === 'task' ? `lastTask${id}` : `lastGift${id}`;
    
    await updateDoc(doc(db, "users", userId), {
        balance: increment(reward),
        [key]: Date.now()
    });

    // Referral Bonus (10%)
    if (userData.referredBy) {
        await updateDoc(doc(db, "users", userData.referredBy), { balance: increment(reward * 0.1) });
    }

    alert('🎉Congratulations🎉 you earned some money!!😍🍍🎉');
    window.location.reload();
};

function startCooldownUI(id, type, mins) {
    const last = userData[type === 'task' ? `lastTask${id}` : `lastGift${id}`] || 0;
    const diff = Date.now() - last;
    const ms = mins * 60 * 1000;

    if (diff < ms) {
        const btn = document.getElementById(`btn-${type[0]}${id}`);
        btn.disabled = true;
        let remaining = Math.floor((ms - diff) / 1000);
        const intv = setInterval(() => {
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            document.getElementById(`timer-${type[0]}${id}`).innerText = `READY IN: ${m}m ${s}s`;
            if (--remaining < 0) { clearInterval(intv); window.location.reload(); }
        }, 1000);
    }
}

// Withdrawal Logic
window.requestWithdraw = async (method) => {
    const amtId = method === 'GCash' ? 'gcashAmount' : 'fpAmount';
    const detailId = method === 'GCash' ? 'gcashNumber' : 'fpEmail';
    const amount = parseFloat(document.getElementById(amtId).value);
    const detail = document.getElementById(detailId).value;

    if (amount > userData.balance || amount <= 0) return alert("Invalid Balance");
    if (!detail) return alert("Enter payment details");

    await addDoc(collection(db, "withdrawals"), {
        userId, username, method, amount,
        usdt: method === 'FaucetPay' ? (amount * PHP_USDT_RATE).toFixed(4) : null,
        detail, status: 'pending', timestamp: serverTimestamp()
    });

    await updateDoc(doc(db, "users", userId), { balance: increment(-amount) });
    alert("Withdrawal Request Sent!");
};

function listenToHistory() {
    const q = query(collection(db, "withdrawals"), where("userId", "==", userId), orderBy("timestamp", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        document.getElementById('history-table').innerHTML = `
            <table class="w-full text-left border-collapse">
                <tr class="bg-slate-800 text-slate-400"><th class="p-2">Method</th><th class="p-2">Amount</th><th class="p-2">Status</th></tr>
                ${snap.docs.map(doc => {
                    const d = doc.data();
                    const color = d.status === 'paid' ? 'text-green-400' : (d.status === 'denied' ? 'text-red-400' : 'text-yellow-400');
                    return `<tr class="border-b border-slate-800">
                        <td class="p-2">${d.method}</td>
                        <td class="p-2">₱${d.amount}</td>
                        <td class="p-2 font-bold ${color}">${d.status.toUpperCase()}</td>
                    </tr>`;
                }).join('')}
            </table>`;
    });
}

// Admin Dashboard
window.openAdmin = () => {
    if (prompt("ADMIN PASSWORD:") === "Propetas6") {
        showPage('adminPage');
        initAdminLogic();
    } else { alert("ACCESS DENIED"); }
};

function initAdminLogic() {
    // Total Paid
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "paid")), snap => {
        let total = 0; snap.forEach(d => total += d.data().amount);
        document.getElementById('totalPaid').innerText = `₱${total.toFixed(2)}`;
    });

    // Pending List
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending"), orderBy("timestamp", "asc")), snap => {
        document.getElementById('totalPending').innerText = snap.size;
        document.getElementById('admin-list').innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            return `
            <div class="glass-card border-l-4 border-yellow-500">
                <div class="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>@${d.username}</span><span>${d.method}</span>
                </div>
                <div class="text-lg font-bold">₱${d.amount} ${d.usdt ? `($${d.usdt} USDT)` : ''}</div>
                <div class="text-xs text-blue-300 font-mono mb-3">${d.detail}</div>
                <div class="flex gap-2">
                    <button onclick="adminAction('${doc.id}', 'paid')" class="bg-green-600 flex-1 p-2 rounded text-[10px] font-bold">APPROVE & PAY</button>
                    <button onclick="adminAction('${doc.id}', 'denied', '${d.userId}', ${d.amount})" class="bg-red-600 flex-1 p-2 rounded text-[10px] font-bold">DENY & REFUND</button>
                </div>
            </div>`;
        }).join('');
    });
}

window.adminAction = async (id, status, uid, refund) => {
    await updateDoc(doc(db, "withdrawals", id), { status });
    if (status === 'denied') {
        await updateDoc(doc(db, "users", uid), { balance: increment(refund) });
    }
};

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

window.copyRef = () => {
    const el = document.getElementById('refLink');
    el.select();
    document.execCommand('copy');
    alert("Referral Link Copied!");
};
