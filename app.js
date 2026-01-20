
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

// User & Telegram Setup
const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user;
const username = user ? `@${user.username || user.first_name}` : "Guest_" + Math.floor(Math.random()*9999);
const userId = user ? user.id.toString() : "guest_" + username;

let balance = 0;
let currentRoom = 'elementary';
let lastChatTime = 0;

/* ================= AUTOMATIC AD ROTATION ================= */
function startAdEngine() {
    const zones = [show_10337853, show_10276123, show_10337795];
    let i = 0;
    setInterval(() => {
        zones[i]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
        i = (i + 1) % zones.length;
    }, 180000); // 3-minute rotation
}

/* ================= CHAT SYSTEM ================= */
window.openChat = (room) => {
    currentRoom = room;
    document.getElementById('chat-title').innerText = room.toUpperCase() + " CHAT";
    showPage('chat-page');
    const q = query(collection(db, "chat_" + room), orderBy("timestamp", "desc"), limit(50));
    onSnapshot(q, (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.docs.reverse().forEach(d => {
            box.innerHTML += `<div class="msg-bubble"><div class="msg-name">${d.data().user}</div><div>${d.data().text}</div></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
};

window.sendChat = async () => {
    const now = Date.now();
    if (now - lastChatTime < 180000) return alert("Please wait 3 minutes!");
    const txt = document.getElementById('chat-input').value;
    if (!txt) return;

    try {
        await show_10276123(); await show_10337795(); await show_10337853();
        await addDoc(collection(db, "chat_" + currentRoom), { user: username, text: txt, timestamp: serverTimestamp() });
        await updateDoc(doc(db, "users", userId), { balance: increment(0.015) });
        lastChatTime = now;
        document.getElementById('chat-input').value = "";
    } catch (e) { alert("Ad interrupted."); }
};

/* ================= GIFT SYSTEM ================= */
const giftZones = { 1: show_10337853, 2: show_10337795, 3: show_10276123 };
window.watchGiftAd = async (id) => {
    try {
        await giftZones[id]('pop');
        document.getElementById(`ad-btn-${id}`).style.display = 'none';
        document.getElementById(`claim-btn-${id}`).style.display = 'block';
    } catch (e) { alert("Ad Error"); }
};

window.claimGift = async (id) => {
    const cd = Date.now() + (3 * 60 * 60 * 1000);
    await updateDoc(doc(db, "users", userId), { balance: increment(0.01), [`gift_${id}_cd`]: cd });
    alert("₱0.01 Claimed!");
    checkCooldowns();
};

async function checkCooldowns() {
    const snap = await getDoc(doc(db, "users", userId));
    const data = snap.data();
    for (let i = 1; i <= 3; i++) {
        const cdTime = data[`gift_${i}_cd`] || 0;
        const now = Date.now();
        const btn = document.getElementById(`ad-btn-${i}`);
        const claim = document.getElementById(`claim-btn-${i}`);
        const txt = document.getElementById(`cd-${i}`);
        
        if (now < cdTime) {
            btn.style.display = 'block'; btn.disabled = true; claim.style.display = 'none';
            const rem = Math.ceil((cdTime - now) / 60000);
            txt.innerText = `Cooldown: ${rem}m`;
        } else {
            btn.disabled = false; txt.innerText = "Ready!";
        }
    }
}

/* ================= WITHDRAWAL ================= */
window.handleWithdraw = async () => {
    const gcash = document.getElementById('gcash-num').value;
    if (balance < 0.02) return alert("Minimum ₱0.02");
    
    const uRef = doc(db, "users", userId);
    const uSnap = await getDoc(uRef);
    if (!uSnap.data().verified) {
        window.open('https://www.youtube.com/@TKGAHLOVERS', '_blank');
        document.getElementById('yt-lock').style.display = 'block';
        let sec = 30;
        const t = setInterval(async () => {
            if (--sec <= 0) {
                clearInterval(t);
                await updateDoc(uRef, { verified: true });
                document.getElementById('yt-lock').style.display = 'none';
                alert("Verified!");
            }
            document.getElementById('yt-timer').innerText = sec;
        }, 1000);
    } else {
        await addDoc(collection(db, "withdrawals"), { userId, username, gcash, amount: balance, status: "Pending", timestamp: serverTimestamp() });
        await updateDoc(uRef, { balance: 0 });
        alert("Request Sent!");
    }
};

/* ================= ADMIN & CORE INIT ================= */
async function verifyAdmin() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        const conf = doc(db, "config", "admin");
        const cSnap = await getDoc(conf);
        if ((cSnap.data()?.count || 0) < 3) {
            await updateDoc(conf, { count: increment(1) });
            await updateDoc(doc(db, "users", userId), { role: 'admin' });
            location.reload();
        } else { alert("Seats full"); }
    }
}
window.verifyAdmin = verifyAdmin;

async function init() {
    const uRef = doc(db, "users", userId);
    const snap = await getDoc(uRef);
    if (!snap.exists()) await setDoc(uRef, { username, balance: 0, verified: false, role: 'user', totalWithdrawn: 0 });

    onSnapshot(uRef, (d) => {
        balance = d.data().balance || 0;
        document.getElementById('gift-balance').innerText = balance.toFixed(3);
        document.getElementById('withdraw-balance').innerText = balance.toFixed(3);
        document.getElementById('live-user').innerText = `👤 User: ${d.data().username}`;
        if (d.data().role === 'admin') document.getElementById('admin-nav-btn').style.display = 'block';
    });

    // Presence
    setDoc(doc(db, "presence", userId), { username, lastSeen: serverTimestamp() });
    onSnapshot(collection(db, "presence"), (s) => {
        document.getElementById('online-list').innerHTML = s.docs.map(d => `<div><span style="color:lime">●</span> ${d.data().username}</div>`).join('');
    });

    // Leaderboard
    onSnapshot(query(collection(db, "users"), orderBy("totalWithdrawn", "desc"), limit(50)), (s) => {
        document.getElementById('leader-table').innerHTML = s.docs.map((d, i) => `<tr><td>${i+1}</td><td>${d.data().username}</td><td>₱${d.data().totalWithdrawn.toFixed(2)}</td></tr>`).join('');
    });

    startAdEngine(); checkCooldowns();
    setInterval(() => { document.getElementById('clock').innerText = new Date().toLocaleString(); }, 1000);
}

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};
window.randomizeTheme = () => {
    const c = ["#00f2ff", "#bc13fe", "#2ecc71", "#e74c3c", "#f1c40f"];
    document.documentElement.style.setProperty('--neon-blue', c[Math.floor(Math.random()*c.length)]);
};

init();
