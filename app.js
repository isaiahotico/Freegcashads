
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

/* --- Core Initialization --- */
const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user;
const userName = user ? `@${user.username || user.first_name}` : "GUEST_" + Math.random().toString(36).substr(2,4);
document.getElementById('st-user').innerText = `👤 ${userName}`;

let myData = { balance: 0, refBonus: 0, referredBy: null, lastActive: 0 };
let currentChatRoom = 'elem'; // Default room

/* --- Global Cooldown Helpers --- */
const getCD = (k) => parseInt(localStorage.getItem(k) || 0);
const setCD = (k) => localStorage.setItem(k, Date.now());

/* --- Real-Time Heartbeat & Online Users --- */
async function updateUserActivity() {
    const now = Date.now();
    await updateDoc(doc(db, 'users', userName), { 
        lastSeen: now,
        status: 'online'
    });
    myData.lastActive = now; // Update local state
    updateOnlineList(); // Refresh list immediately
}
setInterval(updateUserActivity, 20000); // Update every 20s

let unsubOnlineUsers = null;
function updateOnlineList() {
    if(unsubOnlineUsers) unsubOnlineUsers();
    unsubOnlineUsers = onSnapshot(query(collection(db, 'users'), where("lastSeen", ">", Date.now() - 60000), orderBy('lastSeen', 'desc'), limit(25)), s => {
        document.getElementById('online-count').innerText = s.size;
        document.getElementById('online-list').innerHTML = s.docs.map(d => {
            const u = d.data();
            return `<tr><td>${u.username}</td><td>Just now</td><td><span style="color:green">● Online</span></td></tr>`;
        }).join('');
    });
}

/* --- Navigation --- */
window.nav = (p) => {
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active-page'));
    if(['elem','high','college'].includes(p)) {
        currentChatRoom = p;
        document.getElementById('p-chat').classList.add('active-page');
        document.getElementById('chat-title').innerText = p.toUpperCase() + " ROOM";
        initChat();
    } else document.getElementById('p-'+p).classList.add('active-page');
    if (p === 'online') updateOnlineList(); // Ensure online list updates when navigated to
};

/* --- Chat System (Room-Specific 4-Min Cooldown) --- */
let unsubChat = null;
function initChat() {
    if(unsubChat) unsubChat();
    const q = query(collection(db, 'messages'), where("room", "==", currentChatRoom), orderBy('timestamp', 'desc'), limit(30));
    unsubChat = onSnapshot(q, s => {
        document.getElementById('msg-list').innerHTML = s.docs.reverse().map(d => {
            const m = d.data();
            return `<div class="msg ${m.u === userName ? 'msg-me' : 'msg-other'}"><b>${m.u}</b><br>${m.t}</div>`;
        }).join('');
        document.getElementById('msg-list').scrollTop = 9999;
    });
}

document.getElementById('sendBtn').onclick = async () => {
    const text = document.getElementById('m-in').value;
    const cdKey = `cd_chat_${currentChatRoom}`;
    if(Date.now() - getCD(cdKey) < 240000) return alert(`${currentChatRoom.toUpperCase()} has a 4-minute cooldown!`);

    try {
        await show_10337853(); await show_10337795(); await show_10276123();
        if(currentChatRoom === 'elem') await addReward(0.015);
        else document.getElementById('chat-reward-area').style.display = 'block';
        await addDoc(collection(db, 'messages'), { u: userName, t: text, room: currentChatRoom, timestamp: serverTimestamp() });
        setCD(cdKey);
        document.getElementById('m-in').value = '';
    } catch(e) { alert("Error sending message. Try again."); }
};

window.claimChatReward = async () => {
    await addReward(0.015);
    document.getElementById('chat-reward-area').style.display = 'none';
};

/* --- Bonus Ads (3 Ad Sequence / 20m CD) --- */
window.startBonus = async (id) => {
    const cdKey = `cd_bonus_${id}`;
    if(Date.now() - getCD(cdKey) < 1200000) return alert("20 minute cooldown!");

    try {
        await show_10276123(); await show_10337795(); await show_10337853();
        document.getElementById(`clm-b${id}`).style.display = 'block';
    } catch(e) { alert("Ad error. Try again."); }
};

window.claimBonus = async (id) => {
    await addReward(0.015);
    setCD(`cd_bonus_${id}`);
    document.getElementById(`clm-b${id}`).style.display = 'none';
};

/* --- Gift Ads (Rewarded Popup / 3h CD) --- */
window.triggerGift = async (id) => {
    const cdKey = `cd_gift_${id}`;
    if(Date.now() - getCD(cdKey) < 10800000) return alert("3 hour cooldown!");
    
    const zones = { 1: 10337853, 2: 10337795, 3: 10276123 };
    await window[`show_${zones[id]}`]('pop');
    document.getElementById(`clm-g${id}`).style.display = 'block';
};

window.claimGift = async (id) => {
    await addReward(0.01);
    setCD(`cd_gift_${id}`);
    document.getElementById(`clm-g${id}`).style.display = 'none';
};

/* --- Withdrawal System (Unified Sync) --- */
window.requestWd = async () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const gcash = document.getElementById('wd-gcash').value;
    if(amt < 0.02 || amt > myData.balance) return alert("Min 0.02 / Insufficient Balance");
    
    await addDoc(collection(db, 'withdrawals'), {
        u: userName, amount: amt, gcash: gcash, status: 'pending', date: serverTimestamp(), uid: userName // Store username as uid for easier filtering
    });
    await updateDoc(doc(db, 'users', userName), { balance: increment(-amt) });
    alert("Withdrawal requested! Check history below.");
};

let unsubUserWd = null;
function initUserWdHistory() {
    if(unsubUserWd) unsubUserWd();
    unsubUserWd = onSnapshot(query(collection(db, 'withdrawals'), where("uid", "==", userName), orderBy('date','desc'), limit(25)), s => {
        document.getElementById('user-wd-body').innerHTML = s.docs.map(d => {
            const w = d.data();
            let statusClass = '';
            if (w.status === 'approved') statusClass = 'status-approved';
            else if (w.status === 'denied') statusClass = 'status-denied';
            else statusClass = 'status-pending';
            
            return `<tr>
                <td>${w.date?.toDate().toLocaleDateString() || '...'}</td>
                <td>${w.gcash}</td>
                <td>${w.amount}</td>
                <td><span class="status ${statusClass}">${w.status}</span></td>
            </tr>`;
        }).join('');
    });
}

/* --- Referral System --- */
window.setReferrer = async () => {
    const code = document.getElementById('ref-input').value;
    if(!code || code === userName) return alert("Invalid code.");

    const q = query(collection(db, 'users'), where("username", "==", code), limit(1));
    const snapshot = await getDoc(doc(db, 'users', userName)); // Get own data first
    const userData = snapshot.data();

    if(userData.referredBy === code) return alert("Already referred by this user.");
    if(userData.referredBy) alert("You can only link to one referrer.");

    await updateDoc(doc(db, 'users', userName), { referredBy: code });
    alert("Referral code synced!");
    // Optionally, trigger a small bonus for linking
    await addReward(0.005); 
};

window.claimRefBonus = async () => {
    if(myData.refBonus > 0) {
        await addReward(myData.refBonus);
        await updateDoc(doc(db, 'users', userName), { refBonus: 0 });
        alert("Referral bonus claimed to balance!");
    } else alert("No bonus available.");
};

/* --- Help Section --- */
let unsubHelp = null;
function initHelp() {
    if(unsubHelp) unsubHelp();
    unsubHelp = onSnapshot(query(collection(db, 'help'), orderBy('order')), s => {
        document.getElementById('help-content').innerHTML = s.docs.map(d => {
            const h = d.data();
            return `<div class="card" style="text-align:left">
                <div class="card-header">${h.title}</div>
                <p>${h.content}</p>
            </div>`;
        }).join('');
    });
}

/* --- Owner Dashboard --- */
window.loginOwner = () => {
    if(document.getElementById('owner-pass').value === "Propetas12") {
        document.getElementById('owner-login').style.display = 'none';
        document.getElementById('owner-view').style.display = 'block';
        initAdminSync();
    } else alert("Access Denied!");
};

let unsubAdmin = null;
function initAdminSync() {
    if(unsubAdmin) unsubAdmin();
    unsubAdmin = onSnapshot(query(collection(db, 'withdrawals'), orderBy('date','desc'), limit(25)), s => {
        let paid = 0;
        document.getElementById('admin-wd-body').innerHTML = s.docs.map(d => {
            const w = d.data();
            if(w.status === 'approved') paid += w.amount;
            
            let actionButtons = '';
            if(w.status === 'pending') {
                actionButtons = `<button onclick="setWdStatus('${d.id}','approved')" style="background:green; margin-right:3px">✔</button>
                                 <button onclick="setWdStatus('${d.id}','denied')" style="background:red;">✖</button>`;
            } else {
                actionButtons = w.status;
            }
            
            return `<tr>
                <td>${w.u}</td>
                <td>${w.gcash}</td>
                <td>${w.amount}</td>
                <td>${actionButtons}</td>
            </tr>`;
        }).join('');
        document.getElementById('admin-total-paid').innerText = paid.toFixed(2);
    });
}
window.setWdStatus = async (id, s) => { await updateDoc(doc(db, 'withdrawals', id), { status: s }); };

/* --- Leaderboard --- */
let unsubLeaderboard = null;
function initLeaderboard() {
    if(unsubLeaderboard) unsubLeaderboard();
    unsubLeaderboard = onSnapshot(query(collection(db, 'users'), orderBy('balance','desc'), limit(500)), s => {
        document.getElementById('lead-body').innerHTML = s.docs.map((d,i) => {
            const u = d.data();
            return `<tr>
                <td>${i+1}</td>
                <td>${u.username}</td>
                <td>${(u.balance || 0).toFixed(2)}</td>
            </tr>`;
        }).join('');
    });
}

/* --- Global Data Sync --- */
let unsubUserDoc = null;
function syncUserData() {
    if(unsubUserDoc) unsubUserDoc();
    unsubUserDoc = onSnapshot(doc(db, 'users', userName), s => {
        if(s.exists()){
            myData = s.data();
            document.getElementById('st-bal').innerText = `💰 ${myData.balance.toFixed(3)} Peso`;
            document.getElementById('ref-bonus-val').innerText = (myData.refBonus || 0).toFixed(3);
            document.getElementById('ref-my-code').innerText = myData.username; // Use the actual username from Firestore
            updateUserActivity(); // Ensure activity is updated on data fetch
        } else {
            // Create user if it doesn't exist
            setDoc(doc(db, 'users', userName), { username: userName, balance: 0, refBonus: 0, referredBy: null, lastSeen: Date.now() });
        }
    });
}

/* --- Core Reward Function --- */
async function addReward(amt) {
    await updateDoc(doc(db, 'users', userName), { balance: increment(amt) });
    // Visual FX can be added here if implemented
}

/* --- Initialization Calls --- */
syncUserData();
initUserWdHistory();
initLeaderboard();
initHelp();
updateUserActivity(); // Initial activity update
nav('elem'); // Set default view
