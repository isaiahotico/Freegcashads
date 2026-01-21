
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

let currentUser = null;
let userId = localStorage.getItem('paperhouse_uid') || 'user_' + Math.floor(Math.random() * 1000000);

const app = {
    init: async () => {
        if (localStorage.getItem('paperhouse_uid')) {
            userId = localStorage.getItem('paperhouse_uid');
            const snapshot = await get(ref(db, `users/${userId}`));
            if (snapshot.exists()) {
                currentUser = snapshot.val();
                app.showMain();
            }
        }
        
        // Monetag In-App Auto Config
        show_10276123({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    },

    register: async () => {
        const username = document.getElementById('username').value;
        const gcash = document.getElementById('gcash-num').value;
        
        if (username.length < 3 || gcash.length < 10) return alert("Enter valid details");
        
        const userData = {
            uid: userId,
            username: username,
            gcash: gcash,
            balance: 0.00,
            totalAds: 0
        };
        
        await set(ref(db, `users/${userId}`), userData);
        localStorage.setItem('paperhouse_uid', userId);
        currentUser = userData;
        app.showMain();
    },

    showMain: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('display-name').innerText = currentUser.username;
        app.syncData();
        app.loadChat();
    },

    syncData: () => {
        onValue(ref(db, `users/${userId}`), (snapshot) => {
            if (snapshot.exists()) {
                currentUser = snapshot.val();
                const bal = `₱${currentUser.balance.toFixed(2)}`;
                document.getElementById('display-balance').innerText = bal;
                document.getElementById('main-balance').innerText = bal;
            }
        });
    },

    watchAd: (type) => {
        if (type === 'interstitial') {
            show_10276123().then(() => app.rewardUser());
        } else {
            show_10276123('pop').then(() => app.rewardUser()).catch(e => console.log(e));
        }
    },

    rewardUser: async () => {
        const newBalance = parseFloat((currentUser.balance + 0.01).toFixed(2));
        await update(ref(db, `users/${userId}`), {
            balance: newBalance,
            totalAds: (currentUser.totalAds || 0) + 1
        });
        alert("Reward Added: ₱0.01");
    },

    nav: (section) => {
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-tab'));
        
        if (section === 'admin') {
            const pw = prompt("Enter Admin Password:");
            if (pw !== "Propetas12") {
                alert("Wrong Password");
                app.nav('home');
                return;
            }
            app.loadAdmin();
        }

        document.getElementById(`sec-${section}`).classList.remove('hidden');
        event.currentTarget.classList.add('active-tab');
        
        if (section === 'leaderboard') app.loadLeaderboard();
    },

    loadLeaderboard: () => {
        const lbRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
        onValue(lbRef, (snapshot) => {
            const list = document.getElementById('leaderboard-list');
            list.innerHTML = "";
            let users = [];
            snapshot.forEach(child => { users.push(child.val()); });
            users.reverse().forEach((u, i) => {
                list.innerHTML += `
                    <div class="glass p-4 rounded-xl flex justify-between items-center">
                        <span>#${i+1} ${u.username}</span>
                        <span class="text-green-400 font-bold">₱${u.balance.toFixed(2)}</span>
                    </div>
                `;
            });
        });
    },

    sendMessage: async () => {
        const input = document.getElementById('chat-input');
        if (!input.value) return;
        const msg = {
            username: currentUser.username,
            text: input.value,
            time: Date.now()
        };
        await push(ref(db, 'messages'), msg);
        input.value = "";
    },

    loadChat: () => {
        const chatRef = query(ref(db, 'messages'), limitToLast(20));
        onValue(chatRef, (snapshot) => {
            const box = document.getElementById('chat-box');
            box.innerHTML = "";
            snapshot.forEach(child => {
                const m = child.val();
                box.innerHTML += `
                    <div class="bg-slate-800 p-3 rounded-2xl rounded-tl-none w-fit max-w-[80%]">
                        <p class="text-[10px] text-green-400 font-bold">${m.username}</p>
                        <p class="text-sm">${m.text}</p>
                    </div>
                `;
            });
            box.scrollTop = box.scrollHeight;
        });
    },

    showWithdrawModal: async () => {
        if (currentUser.balance < 0.02) return alert("Minimum withdrawal is ₱0.02");
        if (confirm(`Withdraw ₱${currentUser.balance.toFixed(2)} to GCash ${currentUser.gcash}?`)) {
            const req = {
                uid: userId,
                username: currentUser.username,
                gcash: currentUser.gcash,
                amount: currentUser.balance,
                status: 'pending',
                time: Date.now()
            };
            await push(ref(db, 'withdrawals'), req);
            await update(ref(db, `users/${userId}`), { balance: 0 });
            alert("Withdrawal request sent!");
        }
    },

    loadAdmin: () => {
        onValue(ref(db, 'withdrawals'), (snapshot) => {
            const container = document.getElementById('admin-withdrawals');
            container.innerHTML = "";
            snapshot.forEach(child => {
                const w = child.val();
                if (w.status === 'pending') {
                    container.innerHTML += `
                        <div class="glass p-4 rounded-xl">
                            <p>User: ${w.username}</p>
                            <p>GCash: ${w.gcash}</p>
                            <p class="text-yellow-400 font-bold">Amount: ₱${w.amount.toFixed(2)}</p>
                            <button onclick="window.app.approve('${child.key}')" class="bg-green-600 p-2 rounded mt-2 mr-2">Approve</button>
                            <button onclick="window.app.delReq('${child.key}')" class="bg-red-600 p-2 rounded mt-2">Delete</button>
                        </div>
                    `;
                }
            });
        });
    },

    approve: async (id) => {
        await update(ref(db, `withdrawals/${id}`), { status: 'paid' });
        alert("Marked as paid!");
    },
    
    delReq: async (id) => {
        await set(ref(db, `withdrawals/${id}`), null);
    }
};

window.app = app;
app.init();
