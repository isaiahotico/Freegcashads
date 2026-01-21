
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, increment, setDoc, where } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* --- Telegram Init --- */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const userName = user ? `@${user.username || user.first_name}` : "Guest_" + Math.random().toString(36).substr(2, 4);
const userId = user ? user.id.toString() : "G_" + userName;

document.getElementById('st-user').innerText = `👤 ${userName}`;
document.getElementById('ref-code').innerText = userName;

let userData = { balance: 0, refBonus: 0, wdVer: false, referredBy: null };

/* --- In-App Rotating Ads (3 mins) --- */
const inAppZones = [10337853, 10276123, 10337795];
let zIdx = 0;
function rotateInApp() {
    const zone = inAppZones[zIdx];
    if(typeof window[`show_${zone}`] === 'function') {
        window[`show_${zone}`]({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
    zIdx = (zIdx + 1) % inAppZones.length;
}
setInterval(rotateInApp, 180000);
setTimeout(rotateInApp, 3000);

/* --- Navigation --- */
window.nav = (p) => {
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active-page'));
    if(['elem','high','college'].includes(p)) {
        window.curMode = p;
        document.getElementById('p-chat').classList.add('active-page');
        document.getElementById('chat-title').innerText = p.toUpperCase() + " CHAT";
        initChat();
    } else { document.getElementById('p-'+p).classList.add('active-page'); }
};

/* --- Global Money + 8% Referral Logic --- */
async function addMoney(amt) {
    await updateDoc(doc(db, 'users', userId), { balance: increment(amt) });
    if(userData.referredBy) {
        const bonus = amt * 0.08;
        const q = query(collection(db, 'users'), where("username", "==", userData.referredBy), limit(1));
        onSnapshot(q, (snap) => {
            if(!snap.empty) updateDoc(doc(db, 'users', snap.docs[0].id), { refBonus: increment(bonus) });
        }, { once: true });
    }
    const box = document.getElementById('reward-box');
    for(let i=0; i<5; i++) {
        const e = document.createElement('div');
        e.className = 'floating-emoji'; e.innerText = '💎';
        e.style.left = Math.random() * 90 + '%'; e.style.top = '50%';
        box.appendChild(e);
        setTimeout(() => e.remove(), 1500);
    }
}

/* --- GIFT SYSTEM (3-Hour Cooldown) --- */
const GIFT_CD = 10800000; // 3 Hours
const giftZones = { 1: 10337853, 2: 10337795, 3: 10276123 };

window.watchGift = async (id) => {
    const last = parseInt(localStorage.getItem(`gift_cd_${id}`) || 0);
    if(Date.now() - last < GIFT_CD) return alert("Gift cooldown active!");

    const zoneId = giftZones[id];
    try {
        await window[`show_${zoneId}`]('pop');
        document.getElementById(`clm-g${id}`).style.display = 'block';
    } catch(e) { alert("Ad failed to load. Try again."); }
};

window.claimGift = async (id) => {
    await addMoney(0.01);
    localStorage.setItem(`gift_cd_${id}`, Date.now());
    document.getElementById(`clm-g${id}`).style.display = 'none';
    alert("0.01 Peso Gift Claimed!");
};

setInterval(() => {
    [1,2,3].forEach(id => {
        const last = parseInt(localStorage.getItem(`gift_cd_${id}`) || 0);
        const left = GIFT_CD - (Date.now() - last);
        const ui = document.getElementById(`cd-g${id}`);
        if(left > 0) {
            const h = Math.floor(left/3600000);
            const m = Math.floor((left%3600000)/60000);
            const s = Math.floor((left%60000)/1000);
            ui.innerText = `Cooldown: ${h}h ${m}m ${s}s`;
        } else { ui.innerText = "Ready to Open!"; }
    });
}, 1000);

/* --- Chat System --- */
let unsubChat = null;
function initChat() {
    if(unsubChat) unsubChat();
    const q = query(collection(db, `messages_${window.curMode}`), orderBy('timestamp','desc'), limit(50));
    unsubChat = onSnapshot(q, (snap) => {
        const l = document.getElementById('msg-list');
        l.innerHTML = snap.docs.reverse().map(d => {
            const m = d.data();
            return `<div class="msg ${m.u === userName ? 'msg-me' : 'msg-other'}"><b>${m.u}</b><br>${m.t}</div>`;
        }).join('');
        l.scrollTop = l.scrollHeight;
    });
}

document.getElementById('sendBtn').onclick = async () => {
    const t = document.getElementById('m-in').value;
    if(!t) return;
    // Show 3 Rewarded Interstitials
    await window.show_10337853(); await window.show_10337795(); await window.show_10276123();
    
    if(window.curMode === 'elem') await addMoney(0.015);
    else document.getElementById('chat-claim-area').style.display = 'block';

    await addDoc(collection(db, `messages_${window.curMode}`), { u: userName, t, timestamp: serverTimestamp() });
    document.getElementById('m-in').value = '';
};

document.getElementById('chatClaimBtn').onclick = async () => {
    await addMoney(0.015);
    document.getElementById('chat-claim-area').style.display = 'none';
};

/* --- Referrals --- */
window.setRef = async () => {
    const code = document.getElementById('ref-in').value.trim();
    if(code === userName) return alert("Invalid");
    await updateDoc(doc(db, 'users', userId), { referredBy: code });
    alert("Referrer Activated");
};

window.claimBonus = async () => {
    if(userData.refBonus > 0) {
        const b = userData.refBonus;
        await updateDoc(doc(db, 'users', userId), { balance: increment(b), refBonus: 0 });
    }
};

/* --- Admin --- */
window.loginAdmin = () => {
    if(document.getElementById('apw').value === "Propetas12") {
        document.getElementById('admin-lock').style.display = 'none';
        document.getElementById('admin-view').style.display = 'block';
        onSnapshot(query(collection(db, 'withdrawals'), orderBy('date','desc'), limit(25)), (snap) => {
            let p = 0;
            document.getElementById('admin-table').innerHTML = snap.docs.map(d => {
                const w = d.data(); if(w.status === 'approved') p += w.amount;
                return `<tr><td>${w.u}</td><td>${w.amount}</td><td><button onclick="appr('${d.id}')">Approve</button></td></tr>`;
            }).join('');
            document.getElementById('total-p').innerText = p.toFixed(2);
        });
    }
};
window.appr = async (id) => { await updateDoc(doc(db, 'withdrawals', id), { status: 'approved' }); };

/* --- Withdrawal --- */
window.startV = () => {
    let s = 30;
    const i = setInterval(() => {
        s--; document.getElementById('v-timer').innerText = `Verifying... ${s}s`;
        if(s <= 0) { clearInterval(i); updateDoc(doc(db, 'users', userId), { wdVer: true }); }
    }, 1000);
};

window.subWd = async () => {
    const a = parseFloat(document.getElementById('wa').value);
    const g = document.getElementById('wg').value;
    if(a < 0.02 || a > userData.balance) return alert("Error");
    await addDoc(collection(db, 'withdrawals'), { uid: userId, u: userName, amount: a, gcash: g, status: 'pending', date: serverTimestamp() });
    await updateDoc(doc(db, 'users', userId), { balance: increment(-a) });
};

/* --- Global Sync --- */
onSnapshot(doc(db, 'users', userId), (snap) => {
    if(snap.exists()) {
        userData = snap.data();
        document.getElementById('st-bal').innerText = `💰 ${userData.balance.toFixed(3)} Peso`;
        document.getElementById('bonus-amt').innerText = (userData.refBonus || 0).toFixed(3);
        if(userData.wdVer) { document.getElementById('wd-verify').style.display = 'none'; document.getElementById('wd-form').style.display = 'block'; }
    } else {
        setDoc(doc(db, 'users', userId), { username: userName, balance: 0, refBonus: 0, wdVer: false });
    }
});

onSnapshot(query(collection(db, 'users'), orderBy('balance','desc'), limit(50)), (snap) => {
    document.getElementById('lead-body').innerHTML = snap.docs.map((d,i) => `<tr><td>${i+1}</td><td>${d.data().username}</td><td>${d.data().balance.toFixed(2)}</td></tr>`).join('');
});

nav('elem');
