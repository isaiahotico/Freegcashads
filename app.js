
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast, serverTimestamp, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const fb = initializeApp(firebaseConfig);
const db = getDatabase(fb);

const ZONES = ['show_10276123', 'show_10337795', 'show_10337853'];
let user = null;
let uid = localStorage.getItem('ph_uid');
let cd = { premium: 0, turbo: 0, chat: 0 };
let activeTopicId = null;

const app = {
    init: async () => {
        if (!uid) {
            document.getElementById('login-screen').classList.remove('hidden');
        } else {
            const snap = await get(ref(db, `users/${uid}`));
            if (snap.exists()) {
                user = snap.val();
                app.launch();
            } else {
                document.getElementById('login-screen').classList.remove('hidden');
            }
        }
    },

    register: async () => {
        const name = document.getElementById('reg-name').value.trim();
        const gcash = document.getElementById('reg-gcash').value.trim();
        if (name.length < 3 || gcash.length < 10) return alert("Invalid inputs");

        // Check if username taken
        const usersSnap = await get(query(ref(db, 'users'), orderByChild('username'), equalsTo(name)));
        if(usersSnap.exists()) return alert("Username taken");

        uid = 'U' + Math.floor(Math.random() * 900000);
        user = { 
            uid, username: name, gcash, balance: 0, 
            pendingBonus: 0, referredBy: null, totalAds: 0 
        };
        await set(ref(db, `users/${uid}`), user);
        localStorage.setItem('ph_uid', uid);
        app.launch();
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        app.sync();
        app.nav('home');
    },

    sync: () => {
        onValue(ref(db, `users/${uid}`), s => {
            user = s.val();
            document.getElementById('u-name').innerText = user.username;
            document.getElementById('u-balance').innerText = `₱${user.balance.toFixed(4)}`;
            document.getElementById('big-balance').innerText = `₱${user.balance.toFixed(4)}`;
            document.getElementById('ref-unclaimed').innerText = `₱${(user.pendingBonus || 0).toFixed(4)}`;
            app.loadRefList();
        });
    },

    // --- ADS LOGIC ---
    playSequence: async (type) => {
        if (cd[type] > 0) return;
        
        // Sequential 3 Ads
        for (const zone of ZONES) {
            try { if (window[zone]) await window[zone](); } catch (e) {}
        }

        // Reward
        const reward = 0.0102;
        await app.grantReward(reward);
        app.startCD(type, 45);
    },

    grantReward: async (amt) => {
        const updates = {
            balance: (user.balance || 0) + amt,
            totalAds: (user.totalAds || 0) + 1
        };
        await update(ref(db, `users/${uid}`), updates);

        // 8% Commision to Referrer
        if (user.referredBy) {
            const refUserRef = ref(db, `users/${user.referredBy}`);
            const refSnap = await get(refUserRef);
            if (refSnap.exists()) {
                const comm = amt * 0.08;
                await update(refUserRef, {
                    pendingBonus: (refSnap.val().pendingBonus || 0) + comm
                });
            }
        }
    },

    startCD: (type, seconds) => {
        cd[type] = seconds;
        const btnBox = document.getElementById(`box-${type}`);
        const timerBox = document.getElementById(`timer-${type}`);
        const display = timerBox.querySelector('.cd-val');

        btnBox.classList.add('hidden-timer');
        timerBox.classList.remove('hidden-timer');

        const ticker = setInterval(() => {
            cd[type]--;
            if (display) display.innerText = cd[type] + 's';
            if (type === 'chat') document.getElementById('chat-cd').innerText = cd[type];

            if (cd[type] <= 0) {
                clearInterval(ticker);
                btnBox.classList.remove('hidden-timer');
                timerBox.classList.add('hidden-timer');
                if (type === 'chat') document.getElementById('chat-reward-box').classList.add('hidden-timer');
            }
        }, 1000);
    },

    // --- REFERRAL SYSTEM ---
    claimReferral: async () => {
        const code = document.getElementById('ref-input').value.trim();
        if (code === user.username) return alert("Cannot refer yourself");
        
        const q = query(ref(db, 'users'), orderByChild('username'));
        const snap = await get(q);
        let foundUid = null;
        snap.forEach(c => { if(c.val().username === code) foundUid = c.key; });

        if (foundUid) {
            await update(ref(db, `users/${uid}`), { referredBy: foundUid });
            alert("Referrer set successfully!");
        } else {
            alert("Username not found");
        }
    },

    loadRefList: async () => {
        const q = query(ref(db, 'users'), orderByChild('referredBy'));
        const snap = await get(q);
        const list = document.getElementById('ref-list');
        list.innerHTML = "";
        let count = 0;
        snap.forEach(c => {
            if (c.val().referredBy === uid) {
                count++;
                list.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-xs">
                    <span>${c.val().username}</span>
                    <span class="text-yellow-500 font-bold">Active</span>
                </div>`;
            }
        });
        document.getElementById('ref-count').innerText = count;
    },

    claimBonus: async () => {
        if (!user.pendingBonus || user.pendingBonus <= 0) return alert("Nothing to claim");
        const bonus = user.pendingBonus;
        await update(ref(db, `users/${uid}`), {
            balance: (user.balance || 0) + bonus,
            pendingBonus: 0
        });
        alert(`Claimed ₱${bonus.toFixed(4)}`);
    },

    // --- FORUM LOGIC ---
    postTopic: async () => {
        const title = document.getElementById('topic-title').value;
        const desc = document.getElementById('topic-desc').value;
        if (!title || !desc) return;
        await push(ref(db, 'topics'), {
            title, desc, author: user.username, authorUid: uid, timestamp: serverTimestamp()
        });
        app.closeModal('modal-topic');
        app.loadTopics();
    },

    loadTopics: () => {
        onValue(query(ref(db, 'topics'), limitToLast(20)), s => {
            const list = document.getElementById('topics-list');
            list.innerHTML = "";
            s.forEach(c => {
                const t = c.val();
                const isMine = t.authorUid === uid;
                list.innerHTML += `
                    <div class="glass p-4 rounded-2xl active:scale-95 transition" onclick="app.viewTopic('${c.key}')">
                        <div class="flex justify-between">
                            <h4 class="font-bold text-yellow-500">${t.title}</h4>
                            ${isMine ? `<button onclick="event.stopPropagation(); app.editTopic('${c.key}')" class="text-[10px] text-blue-400">EDIT</button>` : ''}
                        </div>
                        <p class="text-xs text-slate-400 mt-1 line-clamp-1">${t.desc}</p>
                    </div>`;
            });
        });
    },

    viewTopic: async (tid) => {
        activeTopicId = tid;
        const snap = await get(ref(db, `topics/${tid}`));
        const t = snap.val();
        const v = document.getElementById('view-content');
        v.innerHTML = `<h2 class="text-xl font-bold text-yellow-500">${t.title}</h2>
                       <p class="text-xs text-slate-500 mb-4">By ${t.author}</p>
                       <p class="text-sm border-b border-slate-800 pb-4 mb-4">${t.desc}</p>
                       <div id="comments-box" class="space-y-2"></div>`;
        app.showModal('modal-view');
        
        onValue(ref(db, `topics/${tid}/comments`), cs => {
            const cbox = document.getElementById('comments-box');
            cbox.innerHTML = "<h5 class='text-[10px] font-bold text-slate-500 uppercase'>Comments</h5>";
            cs.forEach(c => {
                const comm = c.val();
                cbox.innerHTML += `<div class="bg-slate-800/50 p-2 rounded-lg text-xs">
                    <b class="text-blue-400">${comm.u}:</b> ${comm.t}
                </div>`;
            });
        });
    },

    postComment: async () => {
        const val = document.getElementById('comment-input').value;
        if (!val || !activeTopicId) return;
        await push(ref(db, `topics/${activeTopicId}/comments`), {
            u: user.username, t: val
        });
        document.getElementById('comment-input').value = "";
    },

    editTopic: async (tid) => {
        const snap = await get(ref(db, `topics/${tid}`));
        const t = snap.val();
        if (t.authorUid !== uid) return;
        const newDesc = prompt("Edit Content:", t.desc);
        if (newDesc) await update(ref(db, `topics/${tid}`), { desc: newDesc });
    },

    // --- CHAT WITH ADS ---
    sendChatMessage: async () => {
        const input = document.getElementById('chat-input');
        const txt = input.value.trim();
        if (!txt) return;

        // Sequence Ads
        for (const zone of ZONES) {
            try { if (window[zone]) await window[zone](); } catch (e) {}
        }

        // Send Message
        await push(ref(db, 'messages'), {
            u: user.username, uid, t: txt, time: serverTimestamp()
        });
        input.value = "";

        // Reward if not on CD
        if (cd.chat <= 0) {
            await app.grantReward(0.015);
            document.getElementById('chat-reward-box').classList.remove('hidden-timer');
            app.startCD('chat', 300);
        }
    },

    loadChat: () => {
        onValue(query(ref(db, 'messages'), limitToLast(30)), s => {
            const box = document.getElementById('chat-box');
            box.innerHTML = "";
            s.forEach(c => {
                const m = c.val();
                const isMe = m.uid === uid;
                box.innerHTML += `<div class="flex ${isMe?'justify-end':''}"><div class="chat-msg ${isMe?'my-msg':''}">
                    <p class="text-[9px] font-bold text-yellow-500">${m.u}</p>
                    <p class="text-sm">${m.t}</p>
                </div></div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    },

    // --- UTILS ---
    nav: (id) => {
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`sec-${id}`).classList.remove('hidden');
        if (id === 'forum') app.loadTopics();
        if (id === 'chat') app.loadChat();
        if (id === 'history') app.loadHistory();
        if (id === 'admin') app.loadAdmin();
    },

    withdraw: async () => {
        if (user.balance < 1) return alert("Min withdrawal ₱1.00");
        const amt = user.balance;
        await push(ref(db, 'withdrawals'), {
            uid, username: user.username, gcash: user.gcash,
            amount: amt, status: 'pending', timestamp: serverTimestamp()
        });
        await update(ref(db, `users/${uid}`), { balance: 0 });
        alert("Withdrawal Requested!");
    },

    loadHistory: () => {
        onValue(ref(db, 'withdrawals'), s => {
            const l = document.getElementById('hist-list');
            l.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if(w.uid === uid) {
                    l.innerHTML += `<div class="glass p-4 rounded-xl flex justify-between">
                        <span>₱${w.amount.toFixed(2)}</span>
                        <span class="text-[10px] font-bold uppercase ${w.status==='paid'?'text-green-500':'text-yellow-500'}">${w.status}</span>
                    </div>`;
                }
            });
        });
    },

    loadAdmin: () => {
        const p = prompt("Admin Pass:");
        if(p !== "Propetas12") return app.nav('home');
        onValue(ref(db, 'withdrawals'), s => {
            const l = document.getElementById('admin-list');
            l.innerHTML = "";
            s.forEach(c => {
                if(c.val().status === 'pending') {
                    l.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between items-center text-xs">
                        <span>${c.val().username} - ₱${c.val().amount}</span>
                        <button onclick="app.approvePayout('${c.key}')" class="bg-green-600 px-3 py-1 rounded">PAY</button>
                    </div>`;
                }
            });
        });
    },

    approvePayout: (k) => update(ref(db, `withdrawals/${k}`), { status: 'paid' }),
    showModal: (id) => document.getElementById(id).style.display = 'flex',
    closeModal: (id) => document.getElementById(id).style.display = 'none'
};

window.app = app;
app.init();
