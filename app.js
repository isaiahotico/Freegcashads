
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
            return `<tr>
                <td>${w.username}</td>
                <td>₱${w.amount.toFixed(2)}</td>
                <td class="status-${w.status}">${w.status}</td>
                <td>${w.status === 'Pending' ? `<button onclick="approveW('${d.id}')">OK</button>` : 'Done'}</td>
            </tr>`;
        }).join('');
        document.getElementById('owner-page-num').innerText = ownerPage;
    });
}
window.approveW = async (id) => await updateDoc(doc(db, "withdrawals", id), { status: 'Approved' });
window.changeOwnerPage = (v) => { ownerPage = Math.max(1, ownerPage + v); syncOwnerData(); };

/* --- CHAT SYSTEM --- */
window.openChat = (room) => {
    activeRoom = room;
    document.getElementById('chat-title').innerText = room.toUpperCase();
    navTo('page-chat');
    onSnapshot(query(collection(db, "messages"), where("room", "==", room), orderBy("timestamp", "desc"), limit(30)), (s) => {
        document.getElementById('chat-box').innerHTML = s.docs.reverse().map(d => `<div><b>${d.data().user}:</b> ${d.data().text}</div>`).join('');
        document.getElementById('chat-box').scrollTop = 9999;
    });
};
window.sendChat = async () => {
    const val = document.getElementById('chat-input').value;
    if(!val) return;
    try {
        await show_10337853();
        await addDoc(collection(db, "messages"), { user: myUsername, text: val, room: activeRoom, timestamp: serverTimestamp() });
        await updateDoc(doc(db, "users", myUsername), { balance: increment(0.015) });
        document.getElementById('chat-input').value = "";
    } catch(e) { alert("Please watch ad to send."); }
};

/* --- AD SYSTEMS --- */
window.watchGift = async (id) => {
    const now = Date.now();
    const cd = myData[`gift${id}cd`] || 0;
    if(now < cd) return alert("Still on cooldown");
    try {
        await show_10337795();
        await updateDoc(doc(db, "users", myUsername), { balance: increment(0.01), [`gift${id}cd`]: now + 10800000 });
    } catch(e) { console.log("Ad skipped"); }
};

window.watchBonus = async () => {
    const now = Date.now();
    if(now - (myData.lastBonus || 0) < 300000) return alert("Wait 5 mins");
    try {
        await show_10337853(); await show_10337795(); await show_10276123();
        await updateDoc(doc(db, "users", myUsername), { balance: increment(0.015), lastBonus: now });
        if(myData.refBy) await updateDoc(doc(db, "users", myData.refBy), { refEarned: increment(0.0015) });
    } catch(e) { console.log("Ads failed"); }
};

/* --- CORE FUNCTIONS --- */
window.submitWithdraw = async () => {
    const acc = document.getElementById('wd-acc').value;
    if(myData.balance < 0.02) return alert("Min: ₱0.02");
    if(!acc) return alert("Info required");
    await addDoc(collection(db, "withdrawals"), { username: myUsername, amount: myData.balance, status: 'Pending', timestamp: serverTimestamp() });
    await updateDoc(doc(db, "users", myUsername), { balance: 0 });
};

async function init() {
    const uRef = doc(db, "users", myUsername);
    const snap = await getDoc(uRef);
    if(!snap.exists()) await setDoc(uRef, { balance: 0, refEarned: 0 });

    onSnapshot(uRef, (d) => {
        myData = d.data();
        document.getElementById('live-user').innerText = "@" + myUsername;
        document.getElementById('live-bal').innerText = myData.balance.toFixed(3);
        document.getElementById('my-code').innerText = myUsername;
        document.getElementById('ref-bal').innerText = (myData.refEarned || 0).toFixed(3);
        
        // Cooldown UI
        const now = Date.now();
        const bRem = 300000 - (now - (myData.lastBonus || 0));
        document.getElementById('bonus-timer').innerText = bRem > 0 ? Math.ceil(bRem/1000) + "s" : "READY";
    });

    onSnapshot(query(collection(db, "withdrawals"), where("username", "==", myUsername)), (s) => {
        document.getElementById('user-wd-list').innerHTML = s.docs.map(d => `<tr><td>₱${d.data().amount.toFixed(2)}</td><td>${d.data().status}</td><td>${d.data().timestamp?.toDate().toLocaleDateString() || '...'}</td></tr>`).join('');
    });

    onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(10)), (s) => {
        document.getElementById('leader-list').innerHTML = s.docs.map((d, i) => `<tr><td>#${i+1}</td><td>${d.id}</td><td>₱${d.data().balance.toFixed(2)}</td></tr>`).join('');
    });

    // Online presence
    setInterval(() => setDoc(doc(db, "online", myUsername), { ts: serverTimestamp() }), 30000);
    onSnapshot(collection(db, "online"), (s) => {
        document.getElementById('online-count').innerText = s.size;
        document.getElementById('online-list').innerHTML = s.docs.map(d => d.id).join(', ');
    });
}

window.navTo = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

init();
