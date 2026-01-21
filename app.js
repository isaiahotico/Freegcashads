
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

/* --- User Identity --- */
const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user;
const userName = user ? `@${user.username || user.first_name}` : "GUEST_" + Math.random().toString(36).substr(2,4);
const userId = user ? user.id.toString() : "UID_" + userName;

document.getElementById('st-user').innerText = `👤 ${userName}`;
document.getElementById('ref-my-code').innerText = userName;

let myData = { balance: 0, refBonus: 0, referredBy: null };

/* --- Helpers --- */
const getCD = (k) => parseInt(localStorage.getItem(k) || 0);
const setCD = (k) => localStorage.setItem(k, Date.now());

async function addBal(amt) {
    await updateDoc(doc(db, 'users', userName), { balance: increment(amt) });
    if(myData.referredBy) {
        const bonus = amt * 0.08;
        await updateDoc(doc(db, 'users', myData.referredBy), { refBonus: increment(bonus) });
    }
}

/* --- Navigation --- */
window.nav = (p) => {
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active-page'));
    if(['elem','high','college'].includes(p)) {
        window.curChat = p;
        document.getElementById('p-chat').classList.add('active-page');
        document.getElementById('chat-title').innerText = p.toUpperCase() + " ROOM";
        initChat();
    } else document.getElementById('p-'+p).classList.add('active-page');
};

/* --- Chat System (4-Min Cooldown) --- */
let unsubChat = null;
function initChat() {
    if(unsubChat) unsubChat();
    const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(50));
    unsubChat = onSnapshot(q, s => {
        document.getElementById('msg-list').innerHTML = s.docs.reverse().map(d => {
            const m = d.data();
            return `<div class="m-box ${m.u === userName ? 'm-me' : 'm-other'}"><b>${m.u}</b><br>${m.t}</div>`;
        }).join('');
        document.getElementById('msg-list').scrollTop = 9999;
    });
}

document.getElementById('sendBtn').onclick = async () => {
    const text = document.getElementById('m-in').value;
    const lastMsg = getCD('chat_cd_global');
    if(Date.now() - lastMsg < 240000) return alert("All chats have 4 minute cooldown!");

    // Show sequence
    await show_10337853(); await show_10337795(); await show_10276123();
    
    if(window.curChat === 'elem') await addBal(0.015);
    else document.getElementById('chat-reward-box').style.display = 'block';

    await addDoc(collection(db, 'messages'), { u: userName, t: text, room: window.curChat, timestamp: serverTimestamp() });
    setCD('chat_cd_global');
    document.getElementById('m-in').value = '';
};

document.getElementById('chatClaimBtn').onclick = async () => {
    await addBal(0.015);
    document.getElementById('chat-reward-box').style.display = 'none';
};

/* --- Withdrawal System --- */
window.requestWd = async () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const gcash = document.getElementById('wd-gcash').value;
    if(amt < 0.02 || amt > myData.balance) return alert("Check balance/Min 0.02");
    
    await addDoc(collection(db, 'withdrawals'), {
        u: userName, amount: amt, gcash: gcash, status: 'pending', date: serverTimestamp()
    });
    await updateDoc(doc(db, 'users', userName), { balance: increment(-amt) });
    alert("Live Sync: Owner Notified!");
};

onSnapshot(query(collection(db, 'withdrawals'), where("u", "==", userName), orderBy('date','desc'), limit(25)), s => {
    document.getElementById('wd-hist-body').innerHTML = s.docs.map(d => {
        const w = d.data();
        const color = w.status === 'approved' ? 'green' : (w.status === 'denied' ? 'red' : 'orange');
        return `<tr><td>${w.date?.toDate().toLocaleDateString() || '...'}</td><td>${w.gcash}</td><td>${w.amount}</td><td><span class="status-badge" style="background:${color}">${w.status}</span></td></tr>`;
    }).join('');
});

/* --- Owner Dashboard (Secured) --- */
window.loginOwner = () => {
    if(document.getElementById('owner-pw').value === "Propetas12") {
        document.getElementById('owner-auth').style.display = 'none';
        document.getElementById('owner-content').style.display = 'block';
        initAdminSync();
    } else alert("Restricted!");
};

function initAdminSync() {
    onSnapshot(query(collection(db, 'withdrawals'), orderBy('date', 'desc'), limit(25)), s => {
        let total = 0;
        document.getElementById('admin-wd-body').innerHTML = s.docs.map(d => {
            const w = d.data();
            if(w.status === 'approved') total += w.amount;
            return `<tr><td>${w.u}</td><td>${w.gcash}</td><td>${w.amount}</td><td>
                ${w.status === 'pending' ? `<button onclick="setWdStatus('${d.id}','approved')">✔</button> <button onclick="setWdStatus('${d.id}','denied')">✖</button>` : w.status}
            </td></tr>`;
        }).join('');
        document.getElementById('admin-total-paid').innerText = total.toFixed(2);
    });
}
window.setWdStatus = async (id, s) => { await updateDoc(doc(db, 'withdrawals', id), { status: s }); };

/* --- Leaderboard (Top 500) --- */
onSnapshot(query(collection(db, 'users'), orderBy('balance', 'desc'), limit(500)), s => {
    document.getElementById('lead-body').innerHTML = s.docs.map((d, i) => {
        const u = d.data();
        return `<tr><td>${i+1}</td><td>${u.username}</td><td>${(u.balance || 0).toFixed(2)}</td></tr>`;
    }).join('');
});

/* --- Gift Section (3 Slots) --- */
const giftZones = { 1: 10337853, 2: 10337795, 3: 10276123 };
window.triggerGift = async (n) => {
    const cd = getCD(`gift_cd_${n}`);
    if(Date.now() - cd < 10800000) return alert("3 Hour Cooldown!");
    await window[`show_${giftZones[n]}`]('pop');
    document.getElementById(`clm-g${n}`).style.display = 'block';
};
window.claimGift = async (n) => {
    await addBal(0.01);
    setCD(`gift_cd_${n}`);
    document.getElementById(`clm-g${n}`).style.display = 'none';
};

/* --- Global Sync --- */
onSnapshot(doc(db, 'users', userName), s => {
    if(s.exists()) {
        myData = s.data();
        document.getElementById('st-bal').innerText = `💰 ${myData.balance.toFixed(3)} Peso`;
        document.getElementById('ref-bonus-val').innerText = (myData.refBonus || 0).toFixed(3);
    } else {
        setDoc(doc(db, 'users', userName), { username: userName, balance: 0, refBonus: 0 });
    }
});

// Auto-Rotating In-App Ads
setInterval(() => {
    const zones = [10337853, 10337795, 10276123];
    const z = zones[Math.floor(Math.random()*3)];
    window[`show_${z}`]({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
}, 180000);

nav('elem');
