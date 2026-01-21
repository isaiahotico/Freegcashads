
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

/* --- Initialization --- */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const userName = user ? `@${user.username || user.first_name}` : "Guest_" + Math.random().toString(36).substr(2, 4);
const userId = user ? user.id.toString() : "G_" + userName;

document.getElementById('top-user').innerText = `👤 ${userName}`;
document.getElementById('my-ref-code').innerText = userName;

let userData = { balance: 0, refBonus: 0, wdVerified: false, referredBy: null };

/* --- Utility Functions --- */
const getCD = (k) => parseInt(localStorage.getItem(k) || 0);
const setCD = (k) => localStorage.setItem(k, Date.now());

function showAnim() {
    const layer = document.getElementById('anim-layer');
    for(let i=0; i<6; i++) {
        const d = document.createElement('div');
        d.className = 'reward-icon'; d.innerText = '💎';
        d.style.left = (Math.random() * 80 + 10) + '%';
        layer.appendChild(d);
        setTimeout(() => d.remove(), 1500);
    }
}

async function addReward(amt) {
    await updateDoc(doc(db, 'users', userId), { balance: increment(amt) });
    if(userData.referredBy) {
        const bonus = amt * 0.08;
        const q = query(collection(db, 'users'), where("username", "==", userData.referredBy), limit(1));
        onSnapshot(q, s => { if(!s.empty) updateDoc(doc(db, 'users', s.docs[0].id), { refBonus: increment(bonus) }); }, {once:true});
    }
    showAnim();
}

/* --- Navigation --- */
window.nav = (p) => {
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active-page'));
    if(['elem','high','college'].includes(p)) {
        window.mode = p;
        document.getElementById('p-chat').classList.add('active-page');
        document.getElementById('chat-title').innerText = p.toUpperCase() + " CHAT";
        initChat();
    } else document.getElementById('p-'+p).classList.add('active-page');
};

/* --- BONUS ADS LOGIC (20m CD + 3 Ad Sequence) --- */
window.playBonus = async (id) => {
    const cd = getCD(`bonus_cd_${id}`);
    if(Date.now() - cd < 1200000) return alert("Cooldown active!");

    try {
        await window.show_10276123(); 
        await window.show_10337795(); 
        await window.show_10337853();
        document.getElementById(`bonus-claim-${id}`).style.display = 'block';
    } catch(e) { alert("Ad failed. Check internet."); }
};

window.claimBonus = async (id) => {
    await addReward(0.015);
    setCD(`bonus_cd_${id}`);
    document.getElementById(`bonus-claim-${id}`).style.display = 'none';
};

setInterval(() => {
    [1,2,3].forEach(id => {
        const left = 1200000 - (Date.now() - getCD(`bonus_cd_${id}`));
        const ui = document.getElementById(`bonus-cd-${id}`);
        if(left > 0) ui.innerText = `Wait: ${Math.floor(left/60000)}m ${Math.floor((left%60000)/1000)}s`;
        else ui.innerText = "Ready!";
    });
}, 1000);

/* --- WITHDRAWAL & VERIFICATION --- */
window.startWdTimer = () => {
    window.open("https://www.youtube.com/@TKGAHLOVERS", "_blank");
    let s = 30;
    const i = setInterval(() => {
        s--;
        document.getElementById('wd-timer-display').innerText = `Activating in ${s}s...`;
        if(s <= 0) {
            clearInterval(i);
            updateDoc(doc(db, 'users', userId), { wdVerified: true });
        }
    }, 1000);
};

window.submitWithdraw = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const gcash = document.getElementById('wd-gcash').value;
    if(amt < 0.02 || amt > userData.balance) return alert("Invalid amount or insufficient balance!");
    
    await addDoc(collection(db, 'withdrawals'), {
        uid: userId, u: userName, amount: amt, gcash: gcash, status: 'pending', date: serverTimestamp()
    });
    await updateDoc(doc(db, 'users', userId), { balance: increment(-amt) });
    alert("Request Sent Live!");
};

/* --- OWNER DASHBOARD --- */
window.tryLoginOwner = () => {
    if(document.getElementById('owner-pass').value === "Propetas12") {
        document.getElementById('owner-login').style.display = 'none';
        document.getElementById('owner-panel').style.display = 'block';
        initOwnerSync();
    }
};

function initOwnerSync() {
    onSnapshot(query(collection(db, 'withdrawals'), orderBy('date', 'desc'), limit(25)), (snap) => {
        let totalPaid = 0;
        document.getElementById('owner-requests-body').innerHTML = snap.docs.map(d => {
            const w = d.data();
            if(w.status === 'approved') totalPaid += w.amount;
            return `<tr><td>${w.u}</td><td>${w.gcash}</td><td>${w.amount}</td>
            <td>${w.status === 'pending' ? 
                `<div class="admin-btn-group">
                    <button class="btn-approve" onclick="updateWd('${d.id}','approved')">✔</button>
                    <button class="btn-deny" onclick="updateWd('${d.id}','denied')">✖</button>
                </div>` : w.status}</td></tr>`;
        }).join('');
        document.getElementById('total-paid-display').innerText = totalPaid.toFixed(2);
    });
}
window.updateWd = async (id, status) => { await updateDoc(doc(db, 'withdrawals', id), { status }); };

/* --- CHAT SYSTEM --- */
let unsubChat = null;
function initChat() {
    if(unsubChat) unsubChat();
    const q = query(collection(db, `messages_${window.mode}`), orderBy('timestamp', 'desc'), limit(50));
    unsubChat = onSnapshot(q, s => {
        document.getElementById('msg-list').innerHTML = s.docs.reverse().map(d => {
            const m = d.data();
            return `<div><b>${m.u}:</b> ${m.t}</div>`;
        }).join('');
    });
}

document.getElementById('sendBtn').onclick = async () => {
    const t = document.getElementById('m-input').value;
    if(!t) return;
    await window.show_10276123(); await window.show_10337795(); await window.show_10337853();
    if(window.mode === 'elem') await addReward(0.015);
    else document.getElementById('chat-claim-box').style.display = 'block';
    await addDoc(collection(db, `messages_${window.mode}`), { u: userName, t, timestamp: serverTimestamp() });
    document.getElementById('m-input').value = '';
};

document.getElementById('chatClaimBtn').onclick = async () => {
    await addReward(0.015);
    document.getElementById('chat-claim-box').style.display = 'none';
};

/* --- GLOBAL SYNC --- */
onSnapshot(doc(db, 'users', userId), (snap) => {
    if(snap.exists()) {
        userData = snap.data();
        document.getElementById('top-bal').innerText = `💰 ${userData.balance.toFixed(3)} Peso`;
        document.getElementById('ref-bonus-display').innerText = (userData.refBonus || 0).toFixed(3);
        if(userData.wdVerified) {
            document.getElementById('wd-verify-box').style.display = 'none';
            document.getElementById('wd-main-form').style.display = 'block';
        }
    } else {
        setDoc(doc(db, 'users', userId), { username: userName, balance: 0, refBonus: 0, wdVerified: false });
    }
});

onSnapshot(query(collection(db, 'withdrawals'), orderBy('date','desc'), limit(25)), (snap) => {
    document.getElementById('wd-history-body').innerHTML = snap.docs.filter(d => d.data().uid === userId).map(d => {
        const w = d.data();
        return `<tr><td>${w.date?.toDate().toLocaleDateString() || '...'}</td><td>${w.gcash}</td><td>${w.amount}</td><td class="status-${w.status}">${w.status}</td></tr>`;
    }).join('');
});

nav('elem');
