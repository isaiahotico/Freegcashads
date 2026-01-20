
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

// Global State
const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user;
const rawUsername = user ? (user.username || user.first_name) : "Guest_" + Math.floor(Math.random()*9999);
const liveUsername = "@" + rawUsername;
const userId = user ? user.id.toString() : "id_" + rawUsername;

let myData = {};
let lastChatTimes = { elementary: 0, highschool: 0, college: 0 };

/* ================= CHAT ROOMS ================= */
window.openChat = (room) => {
    currentRoom = room;
    document.getElementById('chat-title').innerText = room.toUpperCase() + " ROOM";
    showPage('chat-page');
    updateChatCooldownDisplay(room);

    onSnapshot(query(collection(db, "chat_" + room), orderBy("timestamp", "desc"), limit(40)), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = snap.docs.reverse().map(d => `
            <div style="margin-bottom:8px;"><b style="color:var(--neon-blue)">${d.data().user}:</b> ${d.data().text}</div>
        `).join('');
        box.scrollTop = box.scrollHeight;
    });
};

function updateChatCooldownDisplay(room) {
    const elapsed = Date.now() - lastChatTimes[room];
    const rem = Math.ceil((180000 - elapsed) / 1000);
    const text = rem > 0 ? `Cooldown: ${rem}s` : "Ready to send!";
    document.getElementById('chat-cooldown-timer').innerText = text;
    document.getElementById('chat-send-btn').disabled = rem > 0;
}
setInterval(() => { if (document.getElementById('chat-page').classList.contains('active')) updateChatCooldownDisplay(currentRoom); }, 1000);

window.sendChat = async () => {
    const room = currentRoom;
    if (Date.now() - lastChatTimes[room] < 180000) return;
    const txt = document.getElementById('chat-input').value;
    if (!txt) return;

    try {
        await show_10276123(); await show_10337795(); await show_10337853();
        await addDoc(collection(db, "chat_" + room), { user: liveUsername, text: txt, timestamp: serverTimestamp() });
        
        // Reward + Referral Bonus
        const reward = 0.015;
        await updateDoc(doc(db, "users", userId), { balance: increment(reward), weeklyEarned: increment(reward) });
        if (myData.referredBy) {
            await updateDoc(doc(db, "users", myData.referredBy), { refBonus: increment(reward * 0.1) });
        }
        
        lastChatTimes[room] = Date.now();
        document.getElementById('chat-input').value = "";
    } catch (e) { alert("Ad failed."); }
};

/* ================= REFERRAL SYSTEM ================= */
window.submitReferral = async () => {
    const code = document.getElementById('ref-input').value.replace('@','').trim();
    if (code === rawUsername) return alert("Cannot refer yourself!");
    
    const q = query(collection(db, "users"), where("username", "==", code), limit(1));
    const snap = await getDocs(q); // Helper needed or use getDoc with specific mapping
    // Simple version: Assuming user exists, update local
    await updateDoc(doc(db, "users", userId), { referredBy: code }); 
    alert("Referrer linked!");
};

window.claimReferralBonus = async () => {
    const bonus = myData.refBonus || 0;
    if (bonus <= 0) return alert("No bonus to claim.");
    await updateDoc(doc(db, "users", userId), { balance: increment(bonus), refBonus: 0 });
    alert("Bonus claimed to main balance!");
};

/* ================= WITHDRAWAL HISTORY ================= */
onSnapshot(query(collection(db, "withdrawals"), where("userId", "==", userId), orderBy("timestamp", "desc")), (snap) => {
    const body = document.getElementById('wd-history-body');
    body.innerHTML = snap.docs.map(d => {
        const data = d.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleDateString() : "...";
        const statusClass = data.status === "Approved" ? "status-approved" : "status-pending";
        return `<tr><td>${date}</td><td>₱${data.amount.toFixed(2)}</td><td class="${statusClass}">${data.status}</td></tr>`;
    }).join('');
});

window.handleWithdraw = async () => {
    const gcash = document.getElementById('gcash-num').value;
    if (myData.balance < 0.02) return alert("Min ₱0.02");
    if (gcash.length < 10) return alert("Invalid GCash");

    await addDoc(collection(db, "withdrawals"), {
        userId, username: rawUsername, amount: myData.balance, gcash, status: "Pending", timestamp: serverTimestamp()
    });
    await updateDoc(doc(db, "users", userId), { balance: 0 });
    alert("Request Sent!");
};

/* ================= ADMIN MANUAL APPROVAL ================= */
window.verifyAdmin = async () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12" || pass === "Propetas6") {
        const conf = await getDoc(doc(db, "config", "admin"));
        if ((conf.data()?.count || 0) < 3) {
            await updateDoc(doc(db, "config", "admin"), { count: increment(1) });
            await updateDoc(doc(db, "users", userId), { role: "admin" });
            location.reload();
        } else { alert("Seats full"); }
    }
};

function loadAdminPanel() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending")), (snap) => {
        const container = document.getElementById('admin-requests');
        container.innerHTML = snap.docs.map(d => `
            <div class="glass-card">
                <b>${d.data().username}</b> - ₱${d.data().amount.toFixed(2)}<br>
                GCash: ${d.data().gcash}<br>
                <button class="btn" style="background:#2ecc71; margin-top:5px;" onclick="approveWD('${d.id}', '${d.data().userId}', ${d.data().amount})">Approve Now</button>
            </div>
        `).join('');
    });
}

window.approveWD = async (id, uid, amt) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "Approved" });
    await updateDoc(doc(db, "users", uid), { totalWithdrawn: increment(amt) });
    await setDoc(doc(db, "config", "stats"), { totalWithdrawn: increment(amt) }, { merge: true });
};

/* ================= CORE INIT ================= */
async function init() {
    document.getElementById('live-user').innerText = "👤 " + liveUsername;
    document.getElementById('my-ref-code').innerText = rawUsername;

    const uRef = doc(db, "users", userId);
    const snap = await getDoc(uRef);
    if (!snap.exists()) {
        await setDoc(uRef, { username: rawUsername, balance: 0, weeklyEarned: 0, totalWithdrawn: 0, refBonus: 0, role: "user" });
    }

    onSnapshot(uRef, (d) => {
        myData = d.data();
        document.getElementById('wd-bal').innerText = myData.balance.toFixed(3);
        document.getElementById('ref-bonus-amt').innerText = (myData.refBonus || 0).toFixed(3);
        if (myData.role === "admin") {
            document.getElementById('admin-nav-btn').style.display = "block";
            loadAdminPanel();
        }
    });

    // Leaderboard (Weekly)
    onSnapshot(query(collection(db, "users"), orderBy("weeklyEarned", "desc"), limit(20)), (snap) => {
        document.getElementById('leader-body').innerHTML = snap.docs.map((d, i) => `
            <tr><td>#${i+1}</td><td>${d.data().username}</td><td>₱${d.data().weeklyEarned.toFixed(2)}</td></tr>
        `).join('');
    });

    // Online Status
    setInterval(() => setDoc(doc(db, "online", userId), { username: rawUsername, ts: serverTimestamp() }), 30000);
    onSnapshot(collection(db, "online"), (snap) => {
        document.getElementById('online-count-header').innerText = `👥 Online Users (${snap.size})`;
        document.getElementById('online-list').innerHTML = snap.docs.map(d => `<div><span style="color:lime">●</span> ${d.data().username}</div>`).join('');
    });
}

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

init();
setInterval(() => { document.getElementById('clock').innerText = new Date().toLocaleString(); }, 1000);
