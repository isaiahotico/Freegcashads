
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
const username = user ? `@${user.username || user.first_name}` : "Guest_" + Math.floor(Math.random()*9999);
const userId = user ? user.id.toString() : "guest_" + username;

let balance = 0;
let lastChatTime = 0;

/* ================= GIFT SYSTEM (Update 5) ================= */
const giftZones = { 1: show_10337853, 2: show_10337795, 3: show_10276123 };

window.watchGiftAd = async (giftId) => {
    try {
        await giftZones[giftId]('pop');
        document.getElementById(`ad-btn-${giftId}`).style.display = 'none';
        document.getElementById(`claim-btn-${giftId}`).style.display = 'block';
    } catch (e) {
        alert("Ad failed to load. Try again later.");
    }
};

window.claimGift = async (giftId) => {
    const userRef = doc(db, "users", userId);
    const now = Date.now();
    const cooldownTime = 3 * 60 * 60 * 1000; // 3 Hours

    await updateDoc(userRef, {
        balance: increment(0.01),
        [`gift_${giftId}_cd`]: now + cooldownTime
    });

    document.getElementById(`claim-btn-${giftId}`).style.display = 'none';
    document.getElementById(`ad-btn-${giftId}`).style.display = 'block';
    alert(`Gift #${giftId} Claimed! ₱0.01 added.`);
    checkGiftsCooldown();
};

async function checkGiftsCooldown() {
    const userSnap = await getDoc(doc(db, "users", userId));
    const data = userSnap.data();
    const now = Date.now();

    for (let i = 1; i <= 3; i++) {
        const cd = data[`gift_${i}_cd`] || 0;
        const btn = document.getElementById(`ad-btn-${i}`);
        const cdText = document.getElementById(`cd-${i}`);

        if (now < cd) {
            btn.disabled = true;
            const remaining = Math.ceil((cd - now) / 1000);
            const hours = Math.floor(remaining / 3600);
            const mins = Math.floor((remaining % 3600) / 60);
            cdText.innerText = `Cooldown: ${hours}h ${mins}m remaining`;
        } else {
            btn.disabled = false;
            cdText.innerText = "Ready to claim!";
        }
    }
}
setInterval(checkGiftsCooldown, 60000); // Update timers every minute

/* ================= WITHDRAWAL GATE ================= */
window.handleWithdraw = async () => {
    const gcash = document.getElementById('gcash-num').value;
    if (balance < 0.02) return alert("Min ₱0.02 required");
    
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.data().verified) {
        window.open('https://www.youtube.com/@TKGAHLOVERS', '_blank');
        document.getElementById('yt-gate').style.display = 'block';
        let sec = 30;
        const timer = setInterval(async () => {
            sec--;
            document.getElementById('yt-timer').innerText = sec;
            if (sec <= 0) {
                clearInterval(timer);
                await updateDoc(userRef, { verified: true });
                alert("Account Verified!");
                document.getElementById('yt-gate').style.display = 'none';
            }
        }, 1000);
    } else {
        await addDoc(collection(db, "withdrawals"), {
            userId, username, gcash, amount: balance, status: "Pending", timestamp: serverTimestamp()
        });
        await updateDoc(userRef, { balance: 0 });
        alert("Withdrawal Request Sent!");
    }
};

/* ================= CHAT SYSTEM (3 Ads) ================= */
window.processChat = async () => {
    const now = Date.now();
    if (now - lastChatTime < 180000) return alert("3-minute cooldown!");
    const msg = document.getElementById('chat-msg').value;
    if (!msg) return;

    try {
        await show_10276123();
        await show_10337795();
        await show_10337853();

        await addDoc(collection(db, "chat_elementary"), { // Simplification for demo
            user: username, text: msg, timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, "users", userId), { balance: increment(0.015) });
        lastChatTime = now;
        document.getElementById('chat-msg').value = "";
    } catch (e) { alert("Ads not completed."); }
};

/* ================= INIT ================= */
async function init() {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { username, balance: 0, verified: false, role: 'user' });
    }
    
    onSnapshot(userRef, (d) => {
        balance = d.data().balance || 0;
        document.getElementById('balanceDisplay').innerText = balance.toFixed(3);
    });

    setInterval(() => { document.getElementById('clock').innerText = new Date().toLocaleString(); }, 1000);
    checkGiftsCooldown();
}

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

init();
