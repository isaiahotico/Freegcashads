
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

let user = null;
let uid = localStorage.getItem('ph_gold_uid');

const app = {
    init: async () => {
        if (!uid) {
            document.getElementById('login-screen').classList.remove('hidden');
        } else {
            const snap = await get(ref(db, `users/${uid}`));
            if (snap.exists()) {
                user = snap.val();
                app.checkDailyReset();
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

        uid = 'U' + Math.floor(Math.random() * 9000000);
        user = {
            uid, username: name, gcash, balance: 0,
            totalAds: 0, dailyAds: 0, weeklyAds: 0, dailyEarnings: 0, pendingBonus: 0,
            dailyDate: new Date().toDateString(),
            weeklyId: app.getWeek(),
            referredBy: null, lastLBClaim: ""
        };
        await set(ref(db, `users/${uid}`), user);
        localStorage.setItem('ph_gold_uid', uid);
        app.launch();
    },

    getWeek: () => {
        const d = new Date();
        const start = new Date(d.getFullYear(), 0, 1);
        return `${d.getFullYear()}-W${Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7)}`;
    },

    checkDailyReset: async () => {
        const today = new Date().toDateString();
        if (user.dailyDate !== today) {
            await update(ref(db, `users/${uid}`), {
                dailyAds: 0,
                dailyEarnings: 0,
                dailyDate: today
            });
        }
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        app.sync();
        app.presence();
        app.nav('home');
    },

    sync: () => {
        onValue(ref(db, `users/${uid}`), s => {
            user = s.val();
            if (!user) return;
            document.getElementById('u-name').innerText = user.username;
            document.getElementById('u-balance').innerText = `₱${user.balance.toFixed(4)}`;
            document.getElementById('big-balance').innerText = `₱${user.balance.toFixed(2)}`;
            document.getElementById('p-name').innerText = user.username;
            document.getElementById('p-gcash').innerText = user.gcash;
            document.getElementById('p-bonus').innerText = `₱${(user.pendingBonus || 0).toFixed(4)}`;
            
            const isWeek = user.weeklyId === app.getWeek();
            document.getElementById('st-d').innerText = user.dailyAds || 0;
            document.getElementById('st-w').innerText = isWeek ? user.weeklyAds : 0;
            document.getElementById('st-o').innerText = user.totalAds;
            document.getElementById('lb-progress').innerText = `${isWeek ? user.weeklyAds : 0} / 10000`;
        });

        // Global Stats
        onValue(ref(db, 'stats'), s => {
            const gs = s.val() || {};
            const d = new Date().toDateString();
            const w = app.getWeek();
            document.getElementById('gst-d').innerText = `₱${(gs[d] || 0).toFixed(2)}`;
            document.getElementById('gst-w').innerText = `₱${(gs[w] || 0).toFixed(2)}`;
            document.getElementById('gst-o').innerText = `₱${(gs.total || 0).toFixed(2)}`;
        });
    },

    // AD ENGINE
    playPremium: async () => {
        if (app.cd.premium > 0) return;
        try {
            await show_10276123('pop');
            await show_10337795('pop');
            await show_10337853('pop');
            app.grantReward(0.0043);
            app.startCD('premium', 15);
        } catch (e) {}
    },

    playRandom: async () => {
        if (app.cd.random > 0) return;
        const zones = ['show_10276123', 'show_10337795', 'show_10337853'];
        const randomZone = zones[Math.floor(Math.random() * zones.length)];
        try {
            await window[randomZone]('pop');
            app.grantReward(0.0060);
            app.startCD('random', 45);
        } catch (e) {}
    },

    grantReward: async (amt) => {
        const d = new Date().toDateString();
        const w = app.getWeek();
        const updates = {};
        
        updates[`users/${uid}/balance`] = (user.balance || 0) + amt;
        updates[`users/${uid}/dailyEarnings`] = (user.dailyEarnings || 0) + amt;
        updates[`users/${uid}/totalAds`] = (user.totalAds || 0) + 1;
        updates[`users/${uid}/dailyAds`] = (user.dailyAds || 0) + 1;
        updates[`users/${uid}/weeklyAds`] = (user.weeklyId === w ? user.weeklyAds : 0) + 1;
        updates[`users/${uid}/weeklyId`] = w;

        // Stats
        const sSnap = await get(ref(db, 'stats'));
        const gs = sSnap.val() || {};
        updates['stats/total'] = (gs.total || 0) + amt;
        updates[`stats/${d}`] = (gs[d] || 0) + amt;
        updates[`stats/${w}`] = (gs[w] || 0) + amt;

        // Referral Commission (8%)
        if (user.referredBy) {
            const rSnap = await get(ref(db, `users/${user.referredBy}`));
            if (rSnap.exists()) {
                updates[`users/${user.referredBy}/pendingBonus`] = (rSnap.val().pendingBonus || 0) + (amt * 0.08);
            }
        }
        await update(ref(db), updates);
    },

    cd: { premium: 0, random: 0, chat: 0 },
    startCD: (t, s) => {
        app.cd[t] = s;
        const box = document.getElementById(`box-${t}`);
        const timer = document.getElementById(`timer-${t}`);
        if(box) box.classList.add('hidden-el');
        if(timer) timer.classList.remove('hidden-el');

        const itv = setInterval(() => {
            app.cd[t]--;
            if(timer) timer.querySelector('.cd-val').innerText = app.cd[t] + 's';
            if(t === 'chat') document.getElementById('chat-cd-label').innerText = `Gold CD: ${app.cd[t]}s`;
            if (app.cd[t] <= 0) {
                clearInterval(itv);
                if(box) box.classList.remove('hidden-el');
                if(timer) timer.classList.add('hidden-el');
                if(t === 'chat') document.getElementById('chat-cd-label').innerText = "";
            }
        }, 1000);
    },

    // REFERRALS
    syncReferral: async () => {
        const code = document.getElementById('ref-input').value.trim();
        if(!code || code === user.username) return alert("Invalid code");
        const q = query(ref(db, 'users'), orderByChild('username'));
        const snap = await get(q);
        let found = null;
        snap.forEach(c => { if(c.val().username === code) found = c.key; });
        if(found) {
            await update(ref(db, `users/${uid}`), { referredBy: found });
            alert("Referral Synced Successfully!");
        } else { alert("User not found."); }
    },

    claimBonus: async () => {
        if (!user.pendingBonus || user.pendingBonus <= 0) return alert("No bonus to claim");
        const b = user.pendingBonus;
        await update(ref(db, `users/${uid}`), { balance: user.balance + b, pendingBonus: 0 });
        alert(`Claimed ₱${b.toFixed(4)} Referral Bonus!`);
    },

    // LEADERBOARD
    loadLB: () => {
        // Daily Earners
        onValue(query(ref(db, 'users'), orderByChild('dailyEarnings'), limitToLast(10)), s => {
            const list = document.getElementById('lb-daily'); list.innerHTML = "";
            let data = []; s.forEach(c => data.push(c.val()));
            data.reverse().forEach((u, i) => {
                list.innerHTML += `<div class="gold-card p-3 rounded-xl flex justify-between text-xs font-bold"><span>#${i+1} ${u.username}</span><span class="text-green-400">₱${u.dailyEarnings.toFixed(2)}</span></div>`;
            });
        });
        // Weekly Ads
        onValue(query(ref(db, 'users'), orderByChild('weeklyAds'), limitToLast(10)), s => {
            const list = document.getElementById('lb-ads'); list.innerHTML = "";
            let data = []; s.forEach(c => data.push(c.val()));
            data.reverse().forEach((u, i) => {
                list.innerHTML += `<div class="gold-card p-3 rounded-xl flex justify-between text-xs font-bold"><span>#${i+1} ${u.username}</span><span class="text-blue-400">${u.weeklyAds || 0} ADS</span></div>`;
            });
        });
    },

    claimLB: async () => {
        const w = app.getWeek();
        if(user.weeklyAds < 10000) return alert("You need 10,000 Ads!");
        if(user.lastLBClaim === w) return alert("Claimed this week!");
        await update(ref(db, `users/${uid}`), { balance: user.balance + 25, lastLBClaim: w });
        alert("₱25.00 Reward Bank Claimed!");
    },

    // CHAT
    sendChatMessage: async () => {
        const msg = document.getElementById('chat-input').value.trim();
        if(!msg) return;
        try {
            // Sequence Required to Send
            await show_10276123('pop');
            await show_10337795('pop');
            await show_10337853('pop');
            
            await push(ref(db, 'messages'), { u: user.username, t: msg, uid, time: serverTimestamp() });
            document.getElementById('chat-input').value = "";
            
            if(app.cd.chat <= 0) {
                app.grantReward(0.0200);
                app.startCD('chat', 300);
            }
        } catch(e) {}
    },

    loadChat: () => {
        onValue(query(ref(db, 'messages'), limitToLast(40)), s => {
            const box = document.getElementById('chat-box'); box.innerHTML = "";
            s.forEach(c => {
                const m = c.val();
                const isMe = m.uid === uid;
                box.innerHTML += `<div class="flex ${isMe?'justify-end':''}"><div class="p-3 rounded-2xl max-w-[80%] text-sm ${isMe?'bg-yellow-500 text-black':'bg-slate-800 text-white'}"><b>${m.u}</b><br>${m.t}</div></div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    },

    // FORUM
    submitPost: async () => {
        const t = document.getElementById('post-title').value;
        const b = document.getElementById('post-body').value;
        if(!t || !b) return;
        await push(ref(db, 'forum'), { title: t, body: b, author: user.username, authorUid: uid, time: serverTimestamp() });
        app.closeModal('modal-post');
    },

    loadForum: () => {
        onValue(ref(db, 'forum'), s => {
            const list = document.getElementById('forum-list'); list.innerHTML = "";
            s.forEach(c => {
                const f = c.val();
                const isOwner = f.authorUid === uid;
                list.innerHTML += `<div class="gold-card p-5 rounded-3xl">
                    <div class="flex justify-between items-start mb-2"><h4 class="font-black text-yellow-500">${f.title}</h4>${isOwner?`<button onclick="app.editForum('${c.key}')" class="text-[9px] text-blue-400">EDIT</button>`:''}</div>
                    <p class="text-xs text-slate-300 mb-4">${f.body}</p>
                    <div id="comm-${c.key}" class="space-y-1 mb-3 border-t border-yellow-500/10 pt-2"></div>
                    <div class="flex gap-2"><input id="in-${c.key}" placeholder="Comment..." class="flex-1 bg-slate-950 p-2 rounded-lg text-[10px] outline-none border border-yellow-500/10"><button onclick="app.postComment('${c.key}')" class="gold-btn px-3 rounded-lg text-[9px]">Send</button></div>
                </div>`;
                app.syncComments(c.key);
            });
        });
    },

    postComment: (id) => {
        const t = document.getElementById(`in-${id}`).value;
        if(t) { push(ref(db, `forum/${id}/comments`), { u: user.username, t }); document.getElementById(`in-${id}`).value = ""; }
    },

    syncComments: (id) => {
        onValue(ref(db, `forum/${id}/comments`), s => {
            const box = document.getElementById(`comm-${id}`); box.innerHTML = "";
            s.forEach(c => { box.innerHTML += `<p class="text-[9px]"><b class="text-yellow-500">${c.val().u}:</b> ${c.val().t}</p>`; });
        });
    },

    editForum: async (id) => {
        const snap = await get(ref(db, `forum/${id}`));
        const n = prompt("Edit content:", snap.val().body);
        if(n) update(ref(db, `forum/${id}`), { body: n });
    },

    // ADMIN
    loadAdmin: () => {
        const p = prompt("Owner Pass:");
        if(p !== "Propetas12") return app.nav('home');
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('admin-withdrawals'); list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if(w.status === 'pending') {
                    list.innerHTML += `<div class="gold-card p-4 rounded-xl flex justify-between items-center text-[10px]">
                        <div><b>${w.name}</b><br>₱${w.amount} | ${w.gcash}<br>${w.date} | ${w.time}</div>
                        <button onclick="app.approvePayout('${c.key}')" class="bg-green-600 px-4 py-2 rounded-lg font-bold">APPROVE</button>
                    </div>`;
                }
            });
        });
    },

    approvePayout: (k) => update(ref(db, `withdrawals/${k}`), { status: 'paid' }),

    // WITHDRAW
    withdraw: async () => {
        if(user.balance < 1) return alert("Min ₱1.00");
        const now = new Date();
        await push(ref(db, 'withdrawals'), {
            uid, name: user.username, gcash: user.gcash, amount: user.balance, status: 'pending',
            date: now.toLocaleDateString(), time: now.toLocaleTimeString(), timestamp: serverTimestamp()
        });
        await update(ref(db, `users/${uid}`), { balance: 0 });
        alert("Request Sent!");
    },

    loadHistory: () => {
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('hist-list'); list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if(w.uid === uid) {
                    list.innerHTML += `<div class="gold-card p-4 rounded-xl flex justify-between items-center">
                        <div><p class="font-black text-yellow-500">₱${w.amount.toFixed(2)}</p><p class="text-[9px] text-slate-500">${w.date} ${w.time}</p></div>
                        <span class="text-[9px] font-black uppercase ${w.status==='paid'?'text-green-400':'text-yellow-500'}">${w.status}</span>
                    </div>`;
                }
            });
        });
    },

    // UTILS
    presence: () => {
        const pRef = ref(db, `presence/${uid}`);
        set(pRef, { username: user.username, last_online: serverTimestamp() });
        onDisconnect(pRef).remove();
        setInterval(() => update(pRef, { last_online: serverTimestamp() }), 60000);
        
        onValue(ref(db, 'presence'), s => {
            const list = document.getElementById('online-list'); list.innerHTML = "";
            const now = Date.now();
            let count = 0;
            s.forEach(c => {
                if(now - c.val().last_online < 300000) { // 5 mins
                    count++;
                    list.innerHTML += `<div class="gold-card p-3 rounded-xl text-center text-[10px] font-bold text-green-400 border border-green-400/20">${c.val().username}</div>`;
                }
            });
            document.getElementById('online-indicator').innerText = `${count} Users Online`;
        });
    },

    nav: (id) => {
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden-el'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        document.getElementById(`sec-${id}`).classList.remove('hidden-el');
        if(id === 'leaderboard') app.loadLB();
        if(id === 'chat') app.loadChat();
        if(id === 'forum') app.loadForum();
        if(id === 'history') app.loadHistory();
        if(id === 'admin') app.loadAdmin();
    },

    openModal: (id) => document.getElementById(id).style.display = 'flex',
    closeModal: (id) => document.getElementById(id).style.display = 'none'
};

window.app = app;
app.init();
