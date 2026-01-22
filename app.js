
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, update, onValue, push, serverTimestamp, runTransaction, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  databaseURL: "https://paper-house-inc-default-rtdb.firebaseio.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user || { id: "test", first_name: "User" };
const uid = user.id.toString();

const app = {
    nav: (id) => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById(id).classList.add('active-page');
        event.currentTarget.classList.add('active');
    },

    init: () => {
        document.getElementById('user-greeting').innerText = `Hello, ${user.first_name}`;
        
        // Balance Sync
        onValue(ref(db, `users/${uid}`), (snap) => {
            const data = snap.val();
            document.getElementById('balance').innerText = `₱ ${(data?.balance || 0).toFixed(3)}`;
            if(!data) set(ref(db, `users/${uid}`), { balance: 0, name: user.first_name, lastChat: 0 });
        });

        // Chat Sync
        onValue(query(ref(db, 'messages'), orderByChild('time'), limitToLast(30)), (snap) => {
            const list = document.getElementById('chat-box');
            list.innerHTML = '';
            snap.forEach(child => {
                const m = child.val();
                list.innerHTML += `<div class="p-3 rounded-2xl text-sm ${m.uid === uid ? 'bg-blue-600 text-white self-end' : 'bg-slate-100 self-start'} max-w-[80%]">
                    <p class="text-[10px] opacity-70">${m.name}</p>${m.text}</div>`;
            });
            list.scrollTop = list.scrollHeight;
        });

        // Withdrawal History Sync
        onValue(ref(db, 'withdrawals'), (snap) => {
            const history = document.getElementById('wd-history');
            history.innerHTML = '';
            snap.forEach(child => {
                const w = child.val();
                if(w.uid === uid) {
                    const date = new Date(w.timestamp).toLocaleDateString();
                    history.innerHTML += `<tr class="border-b"><td class="p-3">${date}</td><td class="p-3 font-bold">₱${w.amount}</td><td class="p-3 uppercase text-[10px] font-bold status-${w.status}">${w.status}</td></tr>`;
                }
            });
        });
    },

    playAd: (zoneId) => {
        const adFunc = window[`show_${zoneId}`];
        if(adFunc) {
            adFunc().then(() => {
                runTransaction(ref(db, `users/${uid}/balance`), (b) => (b || 0) + 0.02);
                tg.HapticFeedback.notificationOccurred('success');
            }).catch(() => tg.showAlert("Ad not completed"));
        }
    },

    sendMessage: async () => {
        const input = document.getElementById('chat-input');
        if(!input.value) return;

        tg.showConfirm("Watch 3 Ads to send + Earn ₱0.015?", async (ok) => {
            if(!ok) return;
            try {
                tg.MainButton.setText("Watching Ads (1/3)").show();
                await show_10337853();
                tg.MainButton.setText("Watching Ads (2/3)");
                await show_10337795();
                tg.MainButton.setText("Watching Ads (3/3)");
                await show_10276123();

                const mRef = push(ref(db, 'messages'));
                await set(mRef, { uid, name: user.first_name, text: input.value, time: serverTimestamp() });
                runTransaction(ref(db, `users/${uid}/balance`), (b) => (b || 0) + 0.015);
                input.value = '';
            } catch (e) { tg.showAlert("Ad failed"); }
            finally { tg.MainButton.hide(); }
        });
    },

    requestWithdraw: async () => {
        const amt = parseFloat(document.getElementById('wd-amt').value);
        const gcash = document.getElementById('wd-gcash').value;
        const bSnap = await (await get(ref(db, `users/${uid}/balance`)));
        const bal = bSnap.val() || 0;

        if(amt < 0.02 || amt > bal) return tg.showAlert("Check balance / Minimum 0.02");
        if(!gcash) return tg.showAlert("Enter GCash No.");

        const wRef = push(ref(db, 'withdrawals'));
        await set(wRef, { uid, name: user.first_name, amount: amt, gcash, status: 'pending', timestamp: serverTimestamp() });
        runTransaction(ref(db, `users/${uid}/balance`), (b) => (b || 0) - amt);
        tg.showAlert("Withdrawal requested!");
    },

    unlockAdmin: () => {
        const pass = document.getElementById('admin-pass').value;
        if(pass === "Propetas6") {
            document.getElementById('admin-login').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            app.loadAdminTable();
        } else { tg.showAlert("Wrong password"); }
    },

    loadAdminTable: () => {
        onValue(ref(db, 'withdrawals'), (snapshot) => {
            const list = document.getElementById('admin-withdrawal-list');
            list.innerHTML = '';
            let hasPending = false;
            snapshot.forEach((child) => {
                const w = child.val();
                if (w.status === 'pending') {
                    hasPending = true;
                    list.innerHTML += `
                        <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                            <div class="flex justify-between items-center">
                                <div><p class="font-bold">${w.name}</p><p class="text-xs text-slate-500">${w.gcash}</p></div>
                                <p class="font-black text-green-600">₱${w.amount}</p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="app.adminAction('${child.key}', 'approved')" class="flex-1 bg-green-600 text-white text-[10px] px-4 py-2 rounded-lg font-bold">APPROVE</button>
                                <button onclick="app.adminAction('${child.key}', 'rejected', ${w.amount}, '${w.uid}')" class="bg-red-600 text-white text-[10px] px-4 py-2 rounded-lg font-bold">REJECT</button>
                            </div>
                        </div>`;
                }
            });
            if (!hasPending) list.innerHTML = '<p class="text-center text-slate-500 py-10">No pending withdrawals.</p>';
        });
    },

    adminAction: async (key, status, amount = 0, targetUid = '') => {
        await update(ref(db, `withdrawals/${key}`), { status: status });
        if(status === 'rejected') {
            runTransaction(ref(db, `users/${targetUid}/balance`), (b) => (b || 0) + amount);
        }
        tg.showAlert(`Withdrawal marked as ${status}!`);
    }
};

window.app = app;
app.init();
