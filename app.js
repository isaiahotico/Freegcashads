
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc, increment, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const tg = window.Telegram?.WebApp;
const tgUser = tg?.initDataUnsafe?.user;
const myUsername = tgUser ? (tgUser.username || tgUser.first_name) : "Guest" + Math.floor(Math.random()*9999);
let myData = {};
let activeRoom = 'elementary';
let ownerPage = 1;

// Monetag Ad Functions Mapped
const adFns = {
    1: show_10276123, // Gift 1
    2: show_10337795, // Gift 2
    3: show_10337853  // Bonus Ads (used for all 3)
};

/* --- OWNER DASHBOARD LOGIC --- */
window.openOwnerWall = () => document.getElementById('owner-wall').classList.remove('hidden');
window.closeOwnerWall = () => document.getElementById('owner-wall').classList.add('hidden');

window.verifyOwner = () => {
    const pass = document.getElementById('owner-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('owner-wall').classList.add('hidden');
        navTo('page-owner');
        syncOwnerData();
    } else { alert("Wrong Password"); }
};

function syncOwnerData() {
    onSnapshot(query(collection(db, "withdrawals"), orderBy("timestamp", "desc")), (snap) => {
        const docs = snap.docs;
        const start = (ownerPage - 1) * 25;
        const paged = docs.slice(start, start + 25);
        document.getElementById('owner-list').innerHTML = paged.map(d => {
            const w = d.data();
            // Ensure GCash Info is available, default to '-' if not
            constgcashInfo = w.accountInfo ? w.accountInfo : '-'; 
            return `<tr>
                <td>${w.username}</td>
                <td>${gcashInfo}</td>
                <td>₱${w.amount.toFixed(2)}</td>
                <td class="status-${w.status}">${w.status}</td>
                <td>${w.status === 'Pending' ? `<button onclick="approveW('${d.id}', '${w.username}', ${w.amount})">OK</button>` : 'Done'}</td>
            </tr>`;
        }).join('');
        document.getElementById('owner-page-num').innerText = ownerPage;
    });
}
window.approveW = async (id, username, amount) => {
    await updateDoc(doc(db, "withdrawals", id), { status: 'Approved' });
    // Optional: Add logic here to update user's total withdrawn stats if needed
    alert("Withdrawal Approved!");
};
window.changeOwnerPage = (v) => { ownerPage = Math.max(1, ownerPage + v); syncOwnerData(); };

/* --- CHAT SYSTEM --- */
window.openChat = (room) => {
    activeRoom = room;
    document.getElementById('chat-title').innerText = room.toUpperCase();
    navTo('page-chat');
    onSnapshot(query(collection(db, "messages"), where("room", "==", room), orderBy("timestamp", "desc"), limit(30)), (s) => {
        document.getElementById('chat-box').innerHTML = s.docs.reverse().map(d => `<div><b>${d.data().user}:</b> ${d.data().text}</div>`).join('');
        document.getElementById('chat-box').scrollTop = document.getElementById('chat-box').scrollHeight;
    });
};
window.sendChat = async () => {
    const val = document.getElementById('chat-input').value;
    if(!val) return;
    try {
        // Use a specific ad for chat message rewards
        await adFns[3](); // Using Bonus Ad function for chat
        await addDoc(collection(db, "messages"), { user: myUsername, text: val, room: activeRoom, timestamp: serverTimestamp() });
        await updateDoc(doc(db, "users", myUsername), { balance: increment(0.015) });
        if(myData.refBy) await updateDoc(doc(db, "users", myData.refBy), { refEarned: increment(0.015 * 0.1) });
        document.getElementById('chat-input').value = "";
    } catch(e) { alert("Please watch ad to send message."); }
};

/* --- AD SYSTEMS --- */
const GIFT_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours
const BONUS_AD_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

window.watchGift = async (id) => {
    const now = Date.now();
    const cdKey = `gift${id}cd`;
    const lastAdTime = myData[cdKey] || 0;

    if (now < lastAdTime) {
        const remainingSec = Math.ceil((lastAdTime - now) / 1000);
        alert(`Cooldown active! ${formatTime(remainingSec)} remaining.`);
        return;
    }

    try {
        await adFns[id](); // Call the specific ad function for the gift
        await updateDoc(doc(db, "users", myUsername), { 
            balance: increment(0.01), 
            [cdKey]: now + GIFT_COOLDOWN_MS 
        });
        alert("₱0.01 Claimed!");
        updateGiftTimers(); // Update UI immediately
    } catch(e) { console.log("Ad skipped or failed:", e); alert("Ad interrupted. Try again."); }
};

window.watchBonus = async () => {
    const now = Date.now();
    const lastBonusTime = myData.lastBonusAd || 0;

    if (now - lastBonusTime < BONUS_AD_COOLDOWN_MS) {
        const remainingSec = Math.ceil((BONUS_AD_COOLDOWN_MS - (now - lastBonusTime)) / 1000);
        alert(`Cooldown active! ${formatTime(remainingSec)} remaining.`);
        return;
    }

    try {
        await adFns[3](); // Bonus ads use the third function
        await adFns[2](); // Use a second function as well
        await adFns[1](); // And a third
        
        await updateDoc(doc(db, "users", myUsername), { 
            balance: increment(0.015), 
            lastBonusAd: now 
        });
        if(myData.refBy) await updateDoc(doc(db, "users", myData.refBy), { refEarned: increment(0.015 * 0.1) });
        updateBonusTimer(); // Update UI immediately
    } catch(e) { console.log("Bonus ads failed:", e); alert("Ad experience interrupted. Try again."); }
};

/* --- CORE FUNCTIONS --- */
window.submitWithdraw = async () => {
    const acc = document.getElementById('wd-acc').value;
    if(myData.balance < 0.02) return alert("Min withdrawal: ₱0.02");
    if(!acc) return alert("Please enter your GCash / FaucetPay details.");

    await addDoc(collection(db, "withdrawals"), { 
        username: myUsername, 
        amount: myData.balance, 
        accountInfo: acc, // Store account info
        status: 'Pending', 
        timestamp: serverTimestamp() 
    });
    await updateDoc(doc(db, "users", myUsername), { balance: 0 }); // Reset balance
    alert("Withdrawal request submitted. Check history.");
};

async function init() {
    const uRef = doc(db, "users", myUsername);
    const snap = await getDoc(uRef);
    if(!snap.exists()) {
        await setDoc(uRef, { 
            balance: 0, 
            refEarned: 0,
            lastBonusAd: 0, 
            gift1cd: 0, 
            gift2cd: 0,
            // Add other initializations if needed
        });
    }

    onSnapshot(uRef, (d) => {
        myData = d.data();
        document.getElementById('live-user').innerText = "@" + myUsername;
        document.getElementById('live-bal').innerText = myData.balance.toFixed(3);
        document.getElementById('my-code').innerText = myUsername;
        document.getElementById('ref-bal').innerText = (myData.refEarned || 0).toFixed(3);
        
        updateGiftTimers();
        updateBonusTimer();
    });

    onSnapshot(query(collection(db, "withdrawals"), where("username", "==", myUsername)), (s) => {
        document.getElementById('user-wd-list').innerHTML = s.docs.map(d => {
            const w = d.data();
            const time = w.timestamp?.toDate().toLocaleString() || 'N/A';
            return `<tr><td>₱${w.amount.toFixed(2)}</td><td class="status-${w.status}">${w.status}</td><td>${time}</td></tr>`;
        }).join('');
    });

    onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(10)), (s) => {
        document.getElementById('leader-list').innerHTML = s.docs.map((d, i) => `<tr><td>#${i+1}</td><td>${d.id}</td><td>₱${d.data().balance.toFixed(2)}</td></tr>`).join('');
    });

    // Online presence
    setInterval(() => setDoc(doc(db, "online", myUsername), { ts: serverTimestamp() }, { merge: true }), 30000);
    onSnapshot(collection(db, "online"), (s) => {
        document.getElementById('online-count').innerText = s.size;
        document.getElementById('online-list').innerHTML = s.docs.map(d => d.data().username || d.id).join(', '); // Use username if available
    });
}

window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'page-owner') syncOwnerData();
    if (id === 'page-withdraw') { /* Sync might be implicitly handled by onSnapshot */ }
};

// Timer Update Functions
function updateGiftTimers() {
    const now = Date.now();
    for (let i = 1; i <= 2; i++) {
        const cdKey = `gift${i}cd`;
        const cdTime = myData[cdKey] || 0;
        const timerEl = document.getElementById(`cd-${i}`);
        const btnEl = document.getElementById(`btn-g${i}`);
        
        if (now < cdTime) {
            const remainingSec = Math.ceil((cdTime - now) / 1000);
            timerEl.innerText = formatTime(remainingSec);
            btnEl.disabled = true;
        } else {
            timerEl.innerText = "READY";
            btnEl.disabled = false;
        }
    }
}

function updateBonusTimer() {
    const now = Date.now();
    const lastBonusTime = myData.lastBonusAd || 0;
    const remainingTime = BONUS_AD_COOLDOWN_MS - (now - lastBonusTime);
    const timerEl = document.getElementById('bonus-timer');
    const btnEl = document.getElementById('bonus-btn');

    if (remainingTime > 0) {
        timerEl.innerText = `CD: ${formatTime(Math.ceil(remainingTime / 1000))}`;
        btnEl.disabled = true;
    } else {
        timerEl.innerText = "READY";
        btnEl.disabled = false;
    }
}

// Utility to format time
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    let timeString = "";
    if (h > 0) timeString += `${h}h `;
    if (m > 0 || h > 0) timeString += `${m}m `;
    timeString += `${s}s`;
    return timeString.trim();
}

init();

// Update timers every second if they are visible
setInterval(() => {
    if (document.getElementById('page-gift').classList.contains('active')) updateGiftTimers();
    if (document.getElementById('page-bonus').classList.contains('active')) updateBonusTimer();
}, 1000);
