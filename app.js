
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, increment, setDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

/* --- Telegram & Init --- */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const userName = user ? `@${user.username || user.first_name}` : "Guest_" + Math.random().toString(36).substr(2, 5);
const userId = user ? user.id.toString() : "GUEST_USER";

document.getElementById('userBar').innerText = `👤 ${userName}`;

/* --- App State & Cooldowns --- */
let mode = 'elementary';
let userData = { balance: 0, wdActive: false };

const getCD = (key) => parseInt(localStorage.getItem(key) || 0);
const setCD = (key) => localStorage.setItem(key, Date.now());

/* --- Reward Animations (World Concept) --- */
function playRewardAnim() {
    const container = document.getElementById('reward-popup');
    const styles = ['💎', '💰', '🔥', '✨', '👑'];
    const emoji = styles[Math.floor(Math.random() * styles.length)];
    
    for(let i=0; i<8; i++){
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'anim-coin';
            el.innerText = emoji;
            el.style.left = (Math.random() * 100 - 50) + 'px';
            container.appendChild(el);
            setTimeout(() => el.remove(), 1000);
        }, i * 100);
    }
}

/* --- Ad Logic --- */
async function runAds() {
    try {
        if(typeof show_10337853 === 'function') await show_10337853();
        if(typeof show_10337795 === 'function') await show_10337795();
        if(typeof show_10276123 === 'function') await show_10276123();
    } catch(e) { console.log("Ad Blocked"); }
}

async function showStartAd() {
    if(Date.now() - getCD('last_open_ad') > 180000) {
        const ads = [show_10337853, show_10337795, show_10276123];
        try { await ads[Math.floor(Math.random()*3)](); } catch(e){}
        setCD('last_open_ad');
    }
}

/* --- Navigation & Pages --- */
window.showPage = (p) => {
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active-page'));
    if(['elementary','highschool','college'].includes(p)) {
        mode = p;
        document.getElementById('page-chat').classList.add('active-page');
        document.getElementById('chat-title').innerText = p.toUpperCase() + " CHAT";
        document.getElementById('claim-box').style.display = 'none';
        initChat();
    } else {
        document.getElementById('page-' + p).classList.add('active-page');
    }
};

/* --- Chat System --- */
let unsubChat = null;
function initChat() {
    if(unsubChat) unsubChat();
    const q = query(collection(db, 'messages_' + mode), orderBy('timestamp', 'desc'), limit(50));
    unsubChat = onSnapshot(q, (snap) => {
        const list = document.getElementById('msg-list');
        list.innerHTML = snap.docs.reverse().map(d => {
            const m = d.data();
            return `<div class="m-line ${m.u === userName ? 'm-me' : 'm-other'}"><b>${m.u}</b><br>${m.t}</div>`;
        }).join('');
        list.scrollTop = list.scrollHeight;
    });
}

document.getElementById('sendBtn').onclick = async () => {
    const text = document.getElementById('msgInput').value;
    if(!text || Date.now() - getCD('cd_send_' + mode) < 180000) return alert("Cooldown active!");
    
    await runAds();
    
    if(mode === 'elementary') {
        await updateDoc(doc(db, 'users', userId), { balance: increment(0.015) });
        playRewardAnim();
    } else {
        document.getElementById('claim-box').style.display = 'block';
    }

    await addDoc(collection(db, 'messages_' + mode), { u: userName, t: text, timestamp: serverTimestamp() });
    setCD('cd_send_' + mode);
    document.getElementById('msgInput').value = '';
};

document.getElementById('claimBtn').onclick = async () => {
    if(Date.now() - getCD('cd_claim_' + mode) < 240000) return alert("Claim cooldown!");
    await updateDoc(doc(db, 'users', userId), { balance: increment(0.015) });
    setCD('cd_claim_' + mode);
    playRewardAnim();
    document.getElementById('claim-box').style.display = 'none';
};

/* --- Online Users System --- */
function updateHeartbeat() {
    setDoc(doc(db, 'users', userId), { 
        username: userName, 
        lastSeen: serverTimestamp(),
        online: true 
    }, { merge: true });
}
setInterval(updateHeartbeat, 30000);

onSnapshot(query(collection(db, 'users'), limit(100)), (snap) => {
    const body = document.getElementById('online-body');
    let count = 0;
    const now = Date.now();
    body.innerHTML = snap.docs.map(d => {
        const u = d.data();
        const isOnline = u.lastSeen && (now - u.lastSeen.toMillis() < 60000);
        if(isOnline) count++;
        return isOnline ? `<tr><td>${u.username}</td><td><span class="status-dot"></span> Online</td></tr>` : '';
    }).join('');
    document.getElementById('online-count').innerText = count;
});

/* --- Withdrawal System --- */
window.startWdTimer = () => {
    let s = 30;
    const timer = setInterval(() => {
        s--;
        document.getElementById('wd-timer').innerText = `Activating in ${s}s...`;
        if(s <= 0) {
            clearInterval(timer);
            userData.wdActive = true;
            updateDoc(doc(db, 'users', userId), { wdActive: true });
            checkWdStatus();
        }
    }, 1000);
};

function checkWdStatus() {
    if(userData.wdActive) {
        document.getElementById('wd-activation').style.display = 'none';
        document.getElementById('wd-form').style.display = 'block';
    }
}

window.submitWithdrawal = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const gcash = document.getElementById('wd-gcash').value;
    if(amt < 0.02 || amt > userData.balance) return alert("Invalid amount or min 0.02 required!");
    
    await addDoc(collection(db, 'withdrawals'), {
        uid: userId, u: userName, amount: amt, gcash: gcash, status: 'pending', date: serverTimestamp()
    });
    await updateDoc(doc(db, 'users', userId), { balance: increment(-amt) });
    alert("Request Sent!");
};

/* --- Global Sync --- */
onSnapshot(doc(db, 'users', userId), (snap) => {
    if(snap.exists()){
        userData = snap.data();
        document.getElementById('userBalance').innerText = `💰 ${userData.balance.toFixed(3)} Peso`;
        checkWdStatus();
    } else {
        setDoc(doc(db, 'users', userId), { balance: 0, wdActive: false, username: userName });
    }
});

onSnapshot(query(collection(db, 'withdrawals'), orderBy('date','desc'), limit(15)), (snap) => {
    document.getElementById('wd-history').innerHTML = snap.docs
        .filter(d => d.data().uid === userId)
        .map(d => {
            const w = d.data();
            return `<tr><td>${w.gcash}</td><td>${w.amount}</td><td>${w.status}</td></tr>`;
        }).join('');
});

// Start App
showPage('elementary');
showStartAd();
updateHeartbeat();
