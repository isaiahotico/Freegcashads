
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

// State Management
let currentUser = null;
let userId = localStorage.getItem('ph_uid') || 'U' + Math.floor(Math.random() * 899999 + 100000);
let cooldownTime = 0;
let cooldownInterval = null;

const app = {
    init: async () => {
        // Detect Referral from URL
        const urlParams = new URLSearchParams(window.location.search);
        const refBy = urlParams.get('ref');

        if (localStorage.getItem('ph_uid')) {
            userId = localStorage.getItem('ph_uid');
            const snap = await get(ref(db, `users/${userId}`));
            if (snap.exists()) {
                currentUser = snap.val();
                app.launch();
            }
        }
        
        // Monetag In-App
        show_10337853({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.15, interval: 30, timeout: 5, everyPage: false } });
        show_10337795({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.15, interval: 30, timeout: 5, everyPage: false } });
        show_10276123({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.15, interval: 30, timeout: 5, everyPage: false } });
    },

    register: async () => {
        const name = document.getElementById('reg-name').value.trim();
        const gcash = document.getElementById('reg-gcash').value.trim();
        
        if (name.length < 3 || gcash.length < 10) return alert("Please fill details correctly");

        // Check if referral exists in URL
        const urlParams = new URLSearchParams(window.location.search);
        const refBy = urlParams.get('ref');

        currentUser = {
            uid: userId,
            username: name,
            gcash: gcash,
            balance: 0.0,
            refEarnings: 0.0,
            referredBy: (refBy && refBy !== userId) ? refBy : null,
            totalAds: 0,
            createdAt: Date.now()
        };

        await set(ref(db, `users/${userId}`), currentUser);
        localStorage.setItem('ph_uid', userId);
        app.launch();
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-display').innerText = currentUser.username;
        document.getElementById('ref-link').value = `${window.location.origin}${window.location.pathname}?ref=${userId}`;
        app.syncData();
        app.loadHistory();
    },

    syncData: () => {
        onValue(ref(db, `users/${userId}`), (snap) => {
            if (snap.exists()) {
                currentUser = snap.val();
                const bal = currentUser.balance || 0;
                document.getElementById('balance-display').innerText = `₱${bal.toFixed(2)}`;
                document.getElementById('big-balance').innerText = `₱${bal.toFixed(2)}`;
                document.getElementById('ref-earnings').innerText = `₱${(currentUser.refEarnings || 0).toFixed(2)}`;
                
                // Fetch referral count
                get(query(ref(db, 'users'), orderByChild('referredBy'), userId)).then(s => {
                    document.getElementById('ref-count').innerText = s.size || 0;
                });
            }
        });
    },

    playAd: (type) => {
        if (cooldownTime > 0) return;

        const adPromise = (type === 'inter') ? show_10276123() : show_10276123('pop');
        
        adPromise.then(() => {
            app.rewardLogic();
            app.startCooldown();
        }).catch(() => {
            alert("Ad failed to load. Please try again.");
        });
    },

    rewardLogic: async () => {
        const reward = 0.0065;
        const refBonus = reward * 0.08; // 8% Referral Commission

        // 1. Reward Current User
        const newBalance = (currentUser.balance || 0) + reward;
        await update(ref(db, `users/${userId}`), {
            balance: parseFloat(newBalance.toFixed(4)),
            totalAds: (currentUser.totalAds || 0) + 1
        });

        // 2. Reward Upliner (Referral System)
        if (currentUser.referredBy) {
            const refRef = ref(db, `users/${currentUser.referredBy}`);
            const refSnap = await get(refRef);
            if (refSnap.exists()) {
                const upliner = refSnap.val();
                await update(refRef, {
                    balance: parseFloat(((upliner.balance || 0) + refBonus).toFixed(4)),
                    refEarnings: parseFloat(((upliner.refEarnings || 0) + refBonus).toFixed(4))
                });
            }
        }
    },

    startCooldown: () => {
        cooldownTime = 40;
        document.getElementById('ad-container').classList.add('cooldown-active');
        document.getElementById('cooldown-box').classList.remove('hidden');
        
        cooldownInterval = setInterval(() => {
            cooldownTime--;
            document.getElementById('ad-timer').innerText = cooldownTime;
            if (cooldownTime <= 0) {
                clearInterval(cooldownInterval);
                document.getElementById('ad-container').classList.remove('cooldown-active');
                document.getElementById('cooldown-box').classList.add('hidden');
            }
        }, 1000);
    },

    requestWithdraw: async () => {
        if (currentUser.balance < 0.99) return alert("Minimum withdrawal is ₱1.00");
        
        const req = {
            uid: userId,
            username: currentUser.username,
            gcash: currentUser.gcash,
            amount: currentUser.balance,
            status: 'pending',
            timestamp: Date.now()
        };

        const newKey = push(ref(db, 'withdrawals')).key;
        await set(ref(db, `withdrawals/${newKey}`), req);
        await update(ref(db, `users/${userId}`), { balance: 0 });
        alert("Withdrawal request submitted! Check history for status.");
    },

    loadHistory: () => {
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
                                <p class="text-sm font-bold">₱${w.amount.toFixed(2)}</p>
                                <p class="text-[10px] text-slate-500">${date}</p>
                            </div>
                            <span class="text-[10px] uppercase font-black ${w.status === 'paid' ? 'text-green-500' : 'text-yellow-500'}">${w.status}</span>
                        </div>
                    `;
                }
            });
            if (!hasData) list.innerHTML = `<p class="text-center text-slate-500 py-10">No history yet.</p>`;
        });
    },

    nav: (sec) => {
        if (sec === 'admin') {
            const pw = prompt("Admin Password:");
            if (pw !== "Propetas12") return alert("Access Denied");
            app.loadAdmin();
        }
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        document.getElementById(`sec-${sec}`).classList.remove('hidden');
        event.currentTarget.classList.add('nav-active');
        if (sec === 'chat') app.loadChat();
    },

    loadAdmin: () => {
        onValue(ref(db, 'withdrawals'), (snap) => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            snap.forEach(child => {
                const w = child.val();
                if (w.status === 'pending') {
                    list.innerHTML += `
                        <div class="glass p-4 rounded-xl">
                            <p class="text-xs font-bold">${w.username} (${w.gcash})</p>
                            <h3 class="text-xl font-black text-white">₱${w.amount.toFixed(2)}</h3>
                            <div class="flex gap-2 mt-3">
                                <button onclick="app.adminAction('${child.key}', 'paid')" class="bg-green-600 text-[10px] px-4 py-2 rounded-lg font-bold">APPROVE</button>
                                <button onclick="app.adminAction('${child.key}', 'rejected')" class="bg-red-600 text-[10px] px-4 py-2 rounded-lg font-bold">REJECT</button>
                            </div>
                        </div>
                    `;
                }
            });
        });
    },

    adminAction: async (key, status) => {
        await update(ref(db, `withdrawals/${key}`), { status: status });
    },

    copyRef: () => {
        const link = document.getElementById('ref-link');
        link.select();
        document.execCommand('copy');
        alert("Referral link copied!");
    },

    sendMessage: async () => {
        const input = document.getElementById('chat-input');
        if (!input.value.trim()) return;
        await push(ref(db, 'messages'), {
            u: currentUser.username,
            t: input.value,
            time: Date.now()
        });
        input.value = "";
    },

    loadChat: () => {
        onValue(query(ref(db, 'messages'), limitToLast(20)), (snap) => {
            const box = document.getElementById('chat-box');
            box.innerHTML = "";
            snap.forEach(c => {
                const m = c.val();
                box.innerHTML += `<div class="bg-slate-900/50 p-3 rounded-2xl rounded-tl-none border border-white/5 w-fit max-w-[85%]">
                    <p class="text-[9px] text-yellow-500 font-black mb-1">${m.u}</p>
                    <p class="text-sm">${m.t}</p>
                </div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    }
};

window.app = app;
app.init();
