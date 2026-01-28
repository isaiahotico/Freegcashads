
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const increment = firebase.database.ServerValue.increment;

let myUser = localStorage.getItem('paper_user_id');
let uData = null;

// --- AUTH & INITIALIZATION ---
if(myUser) startApp();

function doAuth() {
    const u = document.getElementById('auth-u').value.trim().toLowerCase();
    const g = document.getElementById('auth-g').value.trim();
    const r = document.getElementById('auth-r').value.trim().toLowerCase();
    if(!u || g.length < 10) return alert("Required: Username & 11-digit GCash");

    db.ref('users/'+u).once('value', s => {
        if(!s.exists()) {
            db.ref('users/'+u).set({
                username: u, gcash: g, balance: 0, adsCount: 0, totalAds: 0,
                refBy: r || "", refCount: 0, refBonus: 0, lastActive: Date.now()
            }).then(() => {
                if(r && r !== u) db.ref('users/'+r+'/refCount').set(increment(1));
            });
        }
        localStorage.setItem('paper_user_id', u);
        location.reload();
    });
}

function startApp() {
    db.ref('users/'+myUser).on('value', s => {
        uData = s.val();
        if(!uData) return;
        syncHomeUI();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-home').classList.add('active');
        document.getElementById('navbar').style.display = 'flex';
    });

    setInterval(() => db.ref('users/'+myUser+'/lastActive').set(Date.now()), 30000);
    setInterval(tickCds, 1000);
    
    loadLeaderboard(); loadOnline(); loadChat(); loadMyHistory(); checkSundayReset();
}

function syncHomeUI() {
    document.getElementById('txt-bal').innerText = uData.balance.toFixed(4);
    document.getElementById('txt-ref-c').innerText = uData.refCount || 0;
    document.getElementById('txt-ref-b').innerText = "₱"+(uData.refBonus || 0).toFixed(4);
    document.getElementById('ref-binder').value = uData.refBy || "";
    if(uData.refBy) document.getElementById('ref-binder').disabled = true;
}

// --- ADS LOGIC (₱0.0201 / 5 MIN) ---
async function getRewardAd(type) {
    try {
        if(type === 'std') {
            await show_10337853(); await show_10276123(); await show_10337795('pop');
            grantBalance(0.0201);
            localStorage.setItem('cd_std', Date.now());
        } else {
            await show_10276123(); await show_10337795(); await show_10337853('pop');
            grantBalance(0.0201);
            localStorage.setItem('cd_pre', Date.now());
        }
    } catch(e) { alert("Ad failed."); }
}

async function sendChatWithAds() {
    const msg = document.getElementById('chat-msg').value.trim();
    if(!msg) return;
    if(Date.now() - (localStorage.getItem('cd_chat')||0) < 300000) return alert("Wait for cooldown");

    alert("Verification: Watch 3 Premium Ads to auto-send.");
    try {
        await show_10337795(); await show_10276123(); await show_10276123('pop');
        db.ref('chat').push({ u: myUser, m: msg, t: Date.now() });
        grantBalance(0.0211);
        localStorage.setItem('cd_chat', Date.now());
        document.getElementById('chat-msg').value = "";
    } catch(e) { alert("Failed to verify ads."); }
}

function grantBalance(amt) {
    const up = {};
    up[`users/${myUser}/balance`] = increment(amt);
    up[`users/${myUser}/adsCount`] = increment(1);
    up[`users/${myUser}/totalAds`] = increment(1);
    db.ref().update(up);
    if(uData.refBy) db.ref('users/'+uData.refBy+'/refBonus').set(increment(amt * 0.08));
    
    document.getElementById('pop-val').innerText = "₱"+amt;
    document.getElementById('reward-pop').style.display = 'block';
    document.getElementById('pop-anim').className = "pop-box animate__animated animate__zoomIn";
    setTimeout(() => document.getElementById('reward-pop').style.display='none', 2000);
}

// --- REAL-TIME LEADERBOARD & LISTS ---
function loadLeaderboard() {
    // Limits to top 100, sorts by balance, updates EVERY time balance changes
    db.ref('users').orderByChild('balance').limitToLast(100).on('value', s => {
        const list = document.getElementById('lb-list'); list.innerHTML = "";
        let users = [];
        s.forEach(c => { users.push(c.val()); });
        users.reverse().forEach((u, i) => {
            list.innerHTML += `<tr><td>${i+1}</td><td>${u.username}</td><td>₱${u.balance.toFixed(2)}</td><td>${u.totalAds}</td></tr>`;
        });
    });
}

function loadOnline() {
    db.ref('users').on('value', s => {
        const el = document.getElementById('online-users'); el.innerHTML = "";
        s.forEach(c => {
            if(Date.now() - c.val().lastActive < 120000) {
                el.innerHTML += `<div style="padding:12px; border-bottom:1px solid #222; display:flex; justify-content:space-between;">
                <span>${c.val().username}</span><span style="color:#0f0">Online</span></div>`;
            }
        });
    });
}

function loadChat() {
    db.ref('chat').limitToLast(25).on('value', s => {
        const win = document.getElementById('chat-window'); win.innerHTML = "";
        s.forEach(c => { const m = c.val(); win.innerHTML += `<div class="msg"><b>${m.u}:</b> ${m.m}</div>`; });
        win.scrollTop = win.scrollHeight;
    });
}

// --- WALLET ---
function submitCashout() {
    const val = parseFloat(document.getElementById('wd-amount').value);
    if(val >= 1 && uData.balance >= val) {
        db.ref('withdrawals').push({
            username: myUser, gcash: uData.gcash, amount: val, status: 'pending', 
            time: Date.now(), dateStr: new Date().toLocaleString()
        });
        db.ref('users/'+myUser+'/balance').set(increment(-val));
        alert("Request Sent to Admin!");
    } else alert("Minimum Cashout: ₱1.00");
}

function loadMyHistory() {
    db.ref('withdrawals').orderByChild('username').equalTo(myUser).on('value', s => {
        const hist = document.getElementById('wd-history'); hist.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            let color = w.status === 'paid' ? '#0f0' : (w.status === 'denied' ? '#f00' : '#f80');
            hist.innerHTML += `<tr><td>${new Date(w.time).toLocaleDateString()}</td><td>₱${w.amount}</td><td style="color:${color}">${w.status}</td></tr>`;
        });
    });
}

// --- ADMIN OWNER DASHBOARD (MANUAL) ---
function tryAdm() {
    if(document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('adm-lock').style.display = 'none';
        document.getElementById('adm-main').style.display = 'block';
        loadAdminData();
    }
}

function loadAdminData() {
    db.ref('withdrawals').on('value', s => {
        const pArea = document.getElementById('adm-pendings'), cArea = document.getElementById('adm-completed');
        let totalPaid = 0; pArea.innerHTML = ""; cArea.innerHTML = "";
        
        s.forEach(c => {
            const w = c.val(); w.id = c.key;
            if(w.status === 'pending') {
                pArea.innerHTML += `
                <div class="admin-item">
                    <b>USER:</b> ${w.username} <br>
                    <b>GCASH:</b> ${w.gcash} <br>
                    <b>AMOUNT:</b> ₱${w.amount} <br>
                    <b>TIME:</b> ${w.dateStr} <br>
                    <button class="btn btn-approve" onclick="updateWd('${w.id}', 'paid')">APPROVE</button>
                    <button class="btn btn-deny" onclick="updateWd('${w.id}', 'denied', ${w.amount}, '${w.username}')">DENY & REFUND</button>
                </div>`;
            } else if(w.status === 'paid') {
                totalPaid += w.amount;
                cArea.innerHTML += `<div style="font-size:0.7rem; border-bottom:1px solid #333; padding:5px;">${w.username} | ₱${w.amount} | PAID</div>`;
            }
        });
        document.getElementById('adm-total').innerText = totalPaid.toFixed(2);
    });
}

function updateWd(id, status, refund = 0, user = "") {
    db.ref('withdrawals/'+id).update({ status: status });
    if(status === 'denied' && refund > 0) {
        db.ref('users/'+user+'/balance').set(increment(refund));
        alert("Denied and Refunded.");
    } else {
        alert("Marked as Paid.");
    }
}

// --- HELPERS ---
function bindReferrer() {
    const code = document.getElementById('ref-binder').value.trim().toLowerCase();
    if(code && code !== myUser && !uData.refBy) {
        db.ref('users/'+code).once('value', s => {
            if(s.exists()){
                db.ref('users/'+myUser).update({ refBy: code });
                db.ref('users/'+code+'/refCount').set(increment(1));
            }
        });
    }
}

function claimBonus() {
    if(uData.refBonus > 0) {
        db.ref('users/'+myUser).update({ balance: increment(uData.refBonus), refBonus: 0 });
    }
}

function tickCds() {
    tick('cd_std', 'btn-std', 'cd-std', 300000);
    tick('cd_pre', 'btn-pre', 'cd-pre', 300000);
    tick('cd_chat', 'btn-chat', 'cd-chat', 300000);
}

function tick(key, bid, sid, limit) {
    const rem = Math.max(0, limit - (Date.now() - (localStorage.getItem(key)||0)));
    const btn = document.getElementById(bid), span = document.getElementById(sid);
    if(rem > 0) {
        btn.disabled = true; btn.style.opacity = 0.5;
        span.innerText = `WAIT ${Math.floor(rem/60000)}m ${Math.floor((rem%60000)/1000)}s`;
    } else {
        btn.disabled = false; btn.style.opacity = 1; span.innerText = "READY";
    }
}

function tab(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function changeVibe() {
    const colors = ['#05050a','#1a1a2e','#0a0a16','#121212'];
    document.body.style.background = colors[Math.floor(Math.random()*colors.length)];
}

function checkSundayReset() {
    db.ref('system/lastReset').once('value', s => {
        if(Date.now() - (s.val()||0) > 604800000) {
            db.ref('users').once('value', ss => {
                ss.forEach(u => db.ref('users/'+u.key+'/adsCount').set(0));
                db.ref('system/lastReset').set(Date.now());
            });
        }
    });
}
