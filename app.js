
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
const user = tg?.initDataUnsafe?.user;
const myUsername = user ? (user.username || user.first_name) : "Guest_" + Math.floor(Math.random()*9999);
let myData = { balance: 0, refBonus: 0 };
let currentRoom = 'elementary';
let ownerPage = 1;
const PAGE_SIZE = 25;
const MONETAG_ZONES = { // Mapping zones to SDK functions
    1: show_10337853,
    2: show_10337795,
    3: show_10276123
};

/* ================= MODAL & NAVIGATION ================= */
window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Specific syncs for pages
    if (id === 'page-owner-dashboard') syncOwnerDashboard();
    if (id === 'page-withdraw') syncUserWithdrawals();
    if (id === 'page-gift') checkIndividualGiftCooldowns();
};
window.showModal = (id) => document.getElementById(id).classList.remove('hidden');
window.hideModal = (id) => document.getElementById(id).classList.add('hidden');

/* ================= OWNER DASHBOARD ================= */
window.submitOwnerLogin = async () => {
    const pass = document.getElementById('owner-pass-input').value;
    if (pass === "Propetas12") {
        hideModal('owner-login-modal');
        navTo('page-owner-dashboard');
        syncOwnerDashboard(); // Start real-time sync for owner
        alert("Owner Dashboard Unlocked!");
    } else {
        alert("Incorrect Access Code.");
    }
};

function syncOwnerDashboard() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending"), orderBy("timestamp", "desc")), (snap) => {
        const docs = snap.docs;
        const body = document.getElementById('owner-table-body');
        const start = (ownerPage - 1) * PAGE_SIZE;
        const paged = docs.slice(start, start + PAGE_SIZE);
        
        body.innerHTML = paged.map(d => {
            const row = d.data();
            const time = row.timestamp?.toDate().toLocaleString() || 'N/A';
            return `<tr>
                <td>${row.username}</td>
                <td>₱${row.amount.toFixed(2)}</td>
                <td class="status-pending">${row.status}</td>
                <td><button class="btn btn-green" onclick="approveWithdrawal('${d.id}', '${row.username}', ${row.amount})">Approve</button></td>
                <td>${time}</td>
            </tr>`;
        }).join('');
        document.getElementById('owner-page-num').innerText = ownerPage;
    });
}

window.approveWithdrawal = async (id, username, amount) => {
    await updateDoc(doc(db, "withdrawals", id), { status: 'Approved' });
    // Optionally update user's total withdrawn stats here if needed
    // await updateDoc(doc(db, "users", username), { totalWithdrawn: increment(amount) });
    alert("Withdrawal Approved!");
};

window.changeOwnerPage = (val) => { ownerPage = Math.max(1, ownerPage + val); syncOwnerDashboard(); };

/* ================= CHAT & EARN ================= */
window.openRoom = (room) => {
    currentRoom = room;
    document.getElementById('chat-title').innerText = room.toUpperCase() + " ROOM";
    navTo('page-chat');
    onSnapshot(query(collection(db, "messages"), where("room", "==", room), orderBy("timestamp", "desc"), limit(40)), (snap) => {
        document.getElementById('chat-box').innerHTML = snap.docs.reverse().map(d => `<div><b>${d.data().user}:</b> ${d.data().text}</div>`).join('');
        document.getElementById('chat-box').scrollTop = document.getElementById('chat-box').scrollHeight;
    });
};

window.sendMessage = async () => {
    const txt = document.getElementById('chat-msg').value;
    if (!txt) return;
    try {
        await MONETAG_ZONES[1](); // Use a specific zone for chat
        await addDoc(collection(db, "messages"), { user: "@"+myUsername, text: txt, room: currentRoom, timestamp: serverTimestamp() });
        await updateDoc(doc(db, "users", myUsername), { balance: increment(0.015) });
        if (myData.referredBy) {
            await updateDoc(doc(db, "users", myData.referredBy), { refBonus: increment(0.015 * 0.1) });
        }
        document.getElementById('chat-msg').value = "";
    } catch (e) { alert("Ad Required for message & earn."); }
};

/* ================= REFERRALS ================= */
window.bindReferral = async () => {
    const friendCode = document.getElementById('ref-input').value.trim();
    if (!friendCode || friendCode === myUsername) return alert("Invalid referral code.");
    
    // Check if the friend exists
    const friendSnap = await getDoc(doc(db, "users", friendCode));
    if (!friendSnap.exists()) return alert("Referral user not found.");

    await updateDoc(doc(db, "users", myUsername), { referredBy: friendCode });
    alert(`Successfully linked to ${friendCode}!`);
};

window.claimReferralBonus = async () => {
    const bonus = myData.refBonus || 0;
    if (bonus <= 0) return alert("No bonus to claim.");
    await updateDoc(doc(db, "users", myUsername), { balance: increment(bonus), refBonus: 0 });
    alert("Referral bonus claimed!");
};

/* ================= PAPER HOUSE GIFT (Individual Ads) ================= */
const individualGiftAds = { 1: MONETAG_ZONES[1], 2: MONETAG_ZONES[2], 3: MONETAG_ZONES[3] }; // Assign each gift to a zone
const GIFT_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours

window.watchIndividualGiftAd = async (id) => {
    try {
        await individualGiftAds[id]();
        // Ad watched, enable claim button
        document.getElementById(`gad-${id}`).classList.add('hidden');
        document.getElementById(`gcl-${id}`).classList.remove('hidden');
    } catch (e) { alert("Ad interrupted or failed."); }
};

window.claimIndividualGift = async (id) => {
    const nextClaimTime = Date.now() + GIFT_COOLDOWN_MS;
    await updateDoc(doc(db, "users", myUsername), { 
        balance: increment(0.01), 
        [`gift_${id}_cooldown`]: nextClaimTime 
    });
    alert("₱0.01 claimed!");
    checkIndividualGiftCooldowns(); // Update UI immediately
};

function checkIndividualGiftCooldowns() {
    const userSnap = myData; // Use the already loaded myData
    for (let i = 1; i <= 3; i++) {
        const cooldownTime = userSnap[`gift_${i}_cooldown`] || 0;
        const now = Date.now();
        const btnAd = document.getElementById(`gad-${i}`);
        const btnClaim = document.getElementById(`gcl-${i}`);
        const timerText = document.getElementById(`gcd-${i}`);

        if (now < cooldownTime) {
            btnAd.classList.add('hidden');
            btnClaim.classList.add('hidden');
            const remainingSec = Math.ceil((cooldownTime - now) / 1000);
            timerText.innerText = `Cooldown: ${formatTime(remainingSec)}`;
        } else {
            btnAd.classList.remove('hidden');
            btnClaim.classList.add('hidden');
            timerText.innerText = "Ready!";
        }
    }
}

/* ================= BONUS ADS (Combined Ads) ================= */
const BONUS_ADS_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

window.watchBonusAds = async () => {
    const now = Date.now();
    if (now - (myData.lastBonusAd || 0) < BONUS_ADS_COOLDOWN_MS) return alert("Cooldown active! Please wait.");

    try {
        await MONETAG_ZONES[1]();
        await MONETAG_ZONES[2]();
        await MONETAG_ZONES[3]();
        
        const bonusAmount = 0.015;
        await updateDoc(doc(db, "users", myUsername), { 
            balance: increment(bonusAmount), 
            lastBonusAd: now 
        });
        if (myData.referredBy) {
            await updateDoc(doc(db, "users", myData.referredBy), { refBonus: increment(bonusAmount * 0.1) });
        }
        showGreeting();
        updateBonusAdsTimer(); // Update timer immediately
    } catch (e) { console.error("Bonus Ads failed:", e); alert("Ad experience interrupted. Try again."); }
};

function showGreeting() {
    const greets = [
        { t: "🌟 PERFECTION!", m: "Your balance just grew!" },
        { t: "💎 IMPERIAL GAIN!", m: "Another successful mission!" },
        { t: "🚀 EMPIRE ADVANCES!", m: "Reward added to your treasury!" }
    ];
    const pick = greets[Math.floor(Math.random() * greets.length)];
    document.getElementById('greet-title').innerText = pick.t;
    document.getElementById('greet-body').innerText = pick.m;
    showModal('greet-modal');
}

function updateBonusAdsTimer() {
    const lastAdTime = myData.lastBonusAd || 0;
    const now = Date.now();
    const remainingTime = lastAdTime + BONUS_ADS_COOLDOWN_MS - now;
    const btn = document.getElementById('bonus-ads-btn');
    const timerDisplay = document.getElementById('bonus-ads-timer');

    if (remainingTime > 0) {
        btn.disabled = true;
        timerDisplay.innerText = `Cooldown: ${formatTime(Math.ceil(remainingTime / 1000))}`;
    } else {
        btn.disabled = false;
        timerDisplay.innerText = "READY!";
    }
}

/* ================= WITHDRAWAL SYSTEM ================= */
window.submitWithdraw = async () => {
    const info = document.getElementById('wd-info').value;
    if (myData.balance < 0.02) return alert("Minimum withdrawal is ₱0.02.");
    if (!info) return alert("Please enter your GCash/FaucetPay details.");

    await addDoc(collection(db, "withdrawals"), {
        username: myUsername,
        amount: myData.balance,
        accountInfo: info, // Store account info
        status: 'Pending',
        timestamp: serverTimestamp()
    });
    await updateDoc(doc(db, "users", myUsername), { balance: 0 }); // Reset user balance
    alert("Withdrawal request submitted. Check history for status.");
};

function syncUserWithdrawals() {
    onSnapshot(query(collection(db, "withdrawals"), where("username", "==", myUsername), orderBy("timestamp", "desc")), (snap) => {
        const body = document.getElementById('wd-body');
        body.innerHTML = snap.docs.map(d => {
            const row = d.data();
            const time = row.timestamp?.toDate().toLocaleString() || 'N/A';
            return `<tr>
                <td>₱${row.amount.toFixed(2)}</td>
                <td class="status-${row.status.toLowerCase()}">${row.status}</td>
                <td>${time}</td>
            </tr>`;
        }).join('');
    });
}

/* ================= ONLINE USERS ================= */
function syncOnlineUsers() {
    setInterval(() => {
        setDoc(doc(db, "online", myUsername), { username: myUsername, lastSeen: serverTimestamp() }, { merge: true });
    }, 20000); // Update every 20 seconds

    onSnapshot(collection(db, "online"), (snap) => {
        document.getElementById('online-total').innerText = snap.size;
        document.getElementById('online-list').innerHTML = snap.docs.map(d => `<div style="margin-bottom:5px;"><span style="color:#2ecc71;">●</span> ${d.data().username}</div>`).join('');
    });
}

/* ================= LEADERBOARD ================= */
function syncLeaderboard() {
    // Assuming 'totalEarned' or 'weeklyEarned' field exists for leaderboard ranking
    onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(20)), (snap) => {
        document.getElementById('leader-body').innerHTML = snap.docs.map((d, idx) => `
            <tr><td>#${idx + 1}</td><td>${d.data().username}</td><td>₱${d.data().balance.toFixed(3)}</td></tr>
        `).join('');
    });
}

/* ================= UTILITIES ================= */
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v < 10 ? "0" + v : v).filter((v, i) => v !== "00" || i > 0).join(":");
}

/* ================= INITIALIZATION ================= */
async function init() {
    document.getElementById('live-user').innerText = "@" + myUsername;
    document.getElementById('ref-code-display').innerText = myUsername;

    const uRef = doc(db, "users", myUsername);
    const snap = await getDoc(uRef);
    if (!snap.exists()) {
        await setDoc(uRef, { username: myUsername, balance: 0, refBonus: 0, lastBonusAd: 0, gift_1_cooldown: 0, gift_2_cooldown: 0, gift_3_cooldown: 0 });
    }

    onSnapshot(uRef, (d) => {
        myData = d.data();
        document.getElementById('live-bal').innerText = myData.balance.toFixed(3);
        document.getElementById('ref-bonus-val').innerText = (myData.refBonus || 0).toFixed(3);
        checkIndividualGiftCooldowns(); // Update gift timers
        updateBonusAdsTimer(); // Update bonus ads timer
    });

    // Start all real-time syncs
    syncOnlineUsers();
    syncLeaderboard();
    // No specific global clock needed, browser handles it.
}

init();
setInterval(() => {
    // These need to be updated frequently for the user, especially if they are on the page.
    // Call them only if the respective page is active for efficiency.
    if (document.getElementById('page-gift').classList.contains('active')) checkIndividualGiftCooldowns();
    if (document.getElementById('page-bonus-ads').classList.contains('active')) updateBonusAdsTimer();
}, 1000); // Update timers every second
