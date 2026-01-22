
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, where, doc, setDoc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= AUTH & USER STATE ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const userName = user ? `@${user.username || user.first_name}` : "Guest_" + Math.floor(Math.random()*999);
const userId = user ? user.id.toString() : "guest_" + userName;

let userData = { balance: 0, bonusBalance: 0, totalEarned: 0, referrer: null, lastChat: 0, lastBonus: { 1: 0, 2: 0, 3: 0 }, lastGift: 0 };
const COOLDOWNS = {
    CHAT: 3 * 60 * 1000, // 3 minutes
    BONUS_ADS: 20 * 60 * 1000, // 20 minutes
    GIFT: 2 * 60 * 60 * 1000 // 2 hours
};
const CHAT_REWARD = 0.015;
const BONUS_ADS_REWARD = 0.015;
const GIFT_REWARD = 0.020;
const REFERRAL_BONUS_PERCENTAGE = 0.08;

/* ================= AD ROTATION (IN-APP) ================= */
const inAppOptions = { type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } };
const monetagAds = [show_10337853, show_10276123, show_10337795]; // Array of ad functions

function rotateInAppAds() {
    monetagAds.forEach((adFunction, index) => {
        setTimeout(() => adFunction(inAppOptions).catch(e => console.log(`Monetag In-App Ad ${index + 1} failed:`, e)), index * 180000); // 3-minute interval
    });
}
setInterval(rotateInAppAds, monetagAds.length * 180000); // Repeat cycle
rotateInAppAds(); // Initial call

/* ================= INITIALIZATION ================= */
async function init() {
    document.getElementById('userBar').innerText = "👤 " + userName;
    document.getElementById('myCode').innerText = userName;

    const uRef = doc(db, "users", userId);
    const snap = await getDoc(uRef);
    if(!snap.exists()) {
        await setDoc(uRef, { name: userName, balance: 0, bonusBalance: 0, totalEarned: 0, referrer: null, lastChat: 0, lastBonus: { 1: 0, 2: 0, 3: 0 }, lastGift: 0, lastSeen: serverTimestamp(), status: 'online' });
    } else {
        // Update user status to online and last seen
        await updateDoc(uRef, { status: 'online', lastSeen: serverTimestamp() });
    }
    startLiveSync();
}

/* ================= PAGE NAVIGATION ================= */
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelector(`.nav-item[onclick="showPage('${id}')"]`).classList.add('active');
    document.getElementById('inputBar').style.display = (id === 'chat') ? 'flex' : 'none';
};

/* ================= COMMON AD & REWARD FUNCTIONS ================= */
const rewardAnims = ['animate__bounceIn', 'animate__flipInX', 'animate__zoomIn', 'animate__backInDown', 'animate__jackInTheBox'];

async function runThreeRewardedAds() {
    Swal.fire({ title: 'Loading 3 Premium Ads...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await monetagAds[0]().catch(e => { console.error("Ad 1 failed:", e); throw e; });
        await monetagAds[1]().catch(e => { console.error("Ad 2 failed:", e); throw e; });
        await monetagAds[2]().catch(e => { console.error("Ad 3 failed:", e); throw e; });
        Swal.close();
        return true;
    } catch (e) {
        Swal.fire("Error", "Ads failed to load. Please try again or check your connection.", "error");
        return false;
    } finally {
        Swal.close();
    }
}

async function giveReward(amount) {
    const uRef = doc(db, "users", userId);
    await updateDoc(uRef, { 
        balance: increment(amount), 
        totalEarned: increment(amount) 
    });
    
    // Referral bonus
    if(userData.referrer) {
        const bonusAmount = amount * REFERRAL_BONUS_PERCENTAGE;
        const q = query(collection(db, "users"), where("name", "==", userData.referrer));
        const referrerSnap = await getDoc(q); // Use getDoc for single document, or getDocs for query
        referrerSnap.forEach(async (referrerDoc) => { // If using query, iterate
            await updateDoc(doc(db, "users", referrerDoc.id), { bonusBalance: increment(bonusAmount) });
        });
    }
    triggerRewardAnim(amount);
}

function triggerRewardAnim(amt) {
    const anim = rewardAnims[Math.floor(Math.random() * rewardAnims.length)];
    Swal.fire({
        title: `+₱${amt.toFixed(3)}`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        showClass: { popup: `animate__animated ${anim}` }
    });
}

/* ================= 1. GLOBAL CHAT ================= */
window.handleMsgSend = async () => {
    const text = document.getElementById('msgInput').value.trim();
    if (!text) return;

    const now = Date.now();
    if (now < userData.lastChat + COOLDOWNS.CHAT) {
        alert(`Chat cooldown: Wait ${Math.ceil((userData.lastChat + COOLDOWNS.CHAT - now) / 1000)}s`);
        return;
    }

    if (await runThreeRewardedAds()) {
        await addDoc(collection(db, "global_chat"), {
            user: userName,
            text: text,
            timestamp: serverTimestamp()
        });
        await giveReward(CHAT_REWARD);
        await updateDoc(doc(db, "users", userId), { lastChat: now });
        document.getElementById('msgInput').value = '';
    }
};

function loadChat() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const q = query(
        collection(db, "global_chat"),
        where("timestamp", ">", threeDaysAgo),
        orderBy("timestamp", "desc"),
        limit(50)
    );

    onSnapshot(q, (snapshot) => {
        const chatDisplay = document.getElementById('chatDisplay');
        chatDisplay.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'msg';
            div.innerHTML = `<b>${data.user}</b>: ${data.text}`;
            chatDisplay.appendChild(div);
        });
    });
}

/* ================= 2. BONUS ADS ================= */
window.runBonus = async (id) => {
    const now = Date.now();
    if (userData.lastBonus[id] && now < userData.lastBonus[id]) {
        alert(`Bonus Ad #${id} cooldown: Wait ${Math.ceil((userData.lastBonus[id] - now) / 60000)} minutes`);
        return;
    }

    if (await runThreeRewardedAds()) {
        const uRef = doc(db, "users", userId);
        const updateObj = { [`lastBonus.${id}`]: now + COOLDOWNS.BONUS_ADS };
        await updateDoc(uRef, updateObj); // Update cooldown first
        await giveReward(BONUS_ADS_REWARD);
        updateBonusButtonState(id);
    }
};

function updateBonusButtonState(id) {
    const btn = document.getElementById(`bonusBtn${id}`);
    const now = Date.now();
    const cooldownTime = userData.lastBonus[id];

    if (cooldownTime && now < cooldownTime) {
        btn.classList.add('btn-disabled');
        btn.disabled = true;
        const updateCountdown = () => {
            const remaining = cooldownTime - Date.now();
            if (remaining <= 0) {
                btn.classList.remove('btn-disabled');
                btn.disabled = false;
                btn.innerText = `BONUS #${id}`;
            } else {
                const mins = Math.ceil(remaining / 60000);
                btn.innerText = `BONUS #${id} (CD: ${mins}m)`;
                setTimeout(updateCountdown, 1000); // Update every second
            }
        };
        updateCountdown();
    } else {
        btn.classList.remove('btn-disabled');
        btn.disabled = false;
        btn.innerText = `BONUS #${id}`;
    }
}

/* ================= 3. PAPER HOUSE GIFT ================= */
window.claimGift = async () => {
    const now = Date.now();
    if (userData.lastGift && now < userData.lastGift) {
        document.getElementById('giftCd').innerText = `Next gift in ${Math.ceil((userData.lastGift - now) / (60 * 1000))} minutes.`;
        return alert("Gift box ready every 2 hours!");
    }
    
    Swal.showLoading();
    await monetagAds[0]().catch(e => console.error("Gift ad failed:", e)); // Just one ad for gift
    Swal.close();

    const uRef = doc(db, "users", userId);
    await updateDoc(uRef, { 
        lastGift: now + COOLDOWNS.GIFT
    });
    await giveReward(GIFT_REWARD);
    updateGiftButtonState();
};

function updateGiftButtonState() {
    const btn = document.getElementById('giftBtn');
    const cdText = document.getElementById('giftCd');
    const now = Date.now();
    const cooldownTime = userData.lastGift;

    if (cooldownTime && now < cooldownTime) {
        btn.classList.add('btn-disabled');
        btn.disabled = true;
        const updateCountdown = () => {
            const remaining = cooldownTime - Date.now();
            if (remaining <= 0) {
                btn.classList.remove('btn-disabled');
                btn.disabled = false;
                btn.innerText = "OPEN GIFT BOX";
                cdText.innerText = "";
            } else {
                const hours = Math.floor(remaining / (3600 * 1000));
                const minutes = Math.ceil((remaining % (3600 * 1000)) / (60 * 1000));
                cdText.innerText = `Next gift in ${hours}h ${minutes}m`;
                setTimeout(updateCountdown, 1000);
            }
        };
        updateCountdown();
    } else {
        btn.classList.remove('btn-disabled');
        btn.disabled = false;
        btn.innerText = "OPEN GIFT BOX";
        cdText.innerText = "";
    }
}

/* ================= 4. REFERRALS ================= */
window.setReferrer = async () => {
    const code = document.getElementById('refInput').value.trim();
    if (!code) return alert("Enter a referral code.");
    if (code === userName) return alert("You cannot refer yourself.");
    if (userData.referrer) return alert("You already have a referrer.");

    const q = query(collection(db, "users"), where("name", "==", code));
    const referrerSnap = await getDoc(q);
    if (!referrerSnap.exists()) return alert("Referral code not found.");

    await updateDoc(doc(db, "users", userId), { referrer: code });
    userData.referrer = code; // Update local state
    alert("Referral activated! You will now earn referral bonuses.");
};

window.claimRefToBalance = async () => {
    if (userData.bonusBalance <= 0) return alert("No bonus to claim!");
    const amount = userData.bonusBalance;

    await updateDoc(doc(db, "users", userId), {
        balance: increment(amount),
        bonusBalance: 0
    });
    triggerRewardAnim(amount);
};

/* ================= 5. WITHDRAWAL ================= */
window.submitWithdraw = async () => {
    const gcash = document.getElementById('wdGcash').value.trim();
    const amt = parseFloat(document.getElementById('wdAmount').value);

    if (gcash.length !== 11 || isNaN(amt) || amt < 0.02 || amt > userData.balance) {
        return alert("Invalid GCash number (11 digits) or amount (min ₱0.02, max your balance).");
    }

    await addDoc(collection(db, "withdrawals"), { 
        userId, name: userName, gcash, amount: amt, status: 'pending', date: serverTimestamp() 
    });
    await updateDoc(doc(db, "users", userId), { balance: increment(-amt) });
    alert("Withdrawal request submitted! Please wait for approval.");
    document.getElementById('wdGcash').value = '';
    document.getElementById('wdAmount').value = '';
};

/* ================= 6. ONLINE USERS ================= */
// Online status heartbeat
setInterval(async () => {
    if(userId && user) { // Only update if a valid Telegram user
        await updateDoc(doc(db, "users", userId), { lastSeen: serverTimestamp(), status: 'online' });
    }
}, 30000); // Every 30 seconds

/* ================= 8. OWNER DASHBOARD ================= */
window.openOwner = async () => {
    const pass = prompt("Enter Admin Password:");
    if(pass === "Propetas12") showPage('admin');
    else alert("Incorrect Password");
};

window.approveWd = async (id, amount, userIdToReward) => {
    // 1. Update withdrawal status
    await updateDoc(doc(db, "withdrawals", id), { status: 'approved' });
    // 2. Update total paid stats
    await setDoc(doc(db, "system", "stats"), { totalPaid: increment(amount) }, { merge: true });
    alert(`Withdrawal ${id} approved.`);
};


/* ================= LIVE DATA SYNCS ================= */
function startLiveSync() {
    // User Balance, Bonus, Cooldowns
    onSnapshot(doc(db, "users", userId), (snap) => {
        if(snap.exists()) {
            userData = snap.data();
            document.getElementById('balance').innerText = userData.balance.toFixed(3);
            document.getElementById('refBonus').innerText = userData.bonusBalance.toFixed(3);
            updateBonusButtonState(1); // Update all bonus buttons
            updateBonusButtonState(2);
            updateBonusButtonState(3);
            updateGiftButtonState(); // Update gift button
        }
    });

    // Global Chat Listener
    loadChat();

    // Online Users Listener
    onSnapshot(query(collection(db, "users"), where("status", "==", "online"), orderBy("lastSeen", "desc"), limit(25)), (snapshot) => {
        document.getElementById('onlineCount').innerText = snapshot.size;
        const list = document.getElementById('onlineList');
        list.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            list.innerHTML += `<tr><td>${data.name}</td><td><span style="color:green">● Online</span></td></tr>`;
        });
    });

    // Leaderboard Listener
    onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(500)), (snapshot) => {
        const list = document.getElementById('lbList');
        list.innerHTML = '';
        let rank = 1;
        snapshot.forEach(doc => {
            const data = doc.data();
            list.innerHTML += `<tr><td>${rank++}</td><td>${data.name}</td><td>₱${data.totalEarned.toFixed(3)}</td></tr>`;
        });
    });

    // User's Withdrawal History
    onSnapshot(query(collection(db, "withdrawals"), where("userId", "==", userId), orderBy("date", "desc"), limit(25)), (snapshot) => {
        const hist = document.getElementById('wdHistory');
        hist.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date?.toDate().toLocaleString() || 'N/A';
            const statusColor = data.status === 'approved' ? 'green' : (data.status === 'pending' ? 'orange' : 'red');
            hist.innerHTML += `<tr><td>₱${data.amount.toFixed(2)}</td><td><span style="color:${statusColor}">${data.status.toUpperCase()}</span></td><td>${date}</td></tr>`;
        });
    });

    // Owner Dashboard Withdrawals
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending"), orderBy("date", "asc")), (snapshot) => {
        const adminWdList = document.getElementById('adminWdList');
        adminWdList.innerHTML = '';
        if (snapshot.empty) {
            adminWdList.innerHTML = '<p>No pending withdrawals.</p>';
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                const date = data.date?.toDate().toLocaleString() || 'N/A';
                adminWdList.innerHTML += `
                    <div class="card" style="border-left: 5px solid ${data.status === 'pending' ? 'orange' : 'green'};">
                        <b>${data.name}</b> (ID: ${data.userId})<br>
                        Amount: ₱<b>${data.amount.toFixed(2)}</b><br>
                        GCash: ${data.gcash}<br>
                        Date: ${date}<br>
                        Status: <span style="font-weight:bold; color:${data.status === 'pending' ? 'orange' : 'green'};">${data.status.toUpperCase()}</span><br>
                        <button class="btn-main btn-blue" onclick="approveWd('${doc.id}', ${data.amount}, '${data.userId}')">APPROVE</button>
                    </div>`;
            });
        }
    });

    // Owner Dashboard Total Paid
    onSnapshot(doc(db, "system", "stats"), (doc) => {
        document.getElementById('adminTotal').innerText = (doc.data()?.totalPaid || 0).toFixed(2);
    });
}

init();
