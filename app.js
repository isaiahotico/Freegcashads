
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

/* ================= AUTH ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const userName = user ? `@${user.username || user.first_name}` : "Guest_" + Math.floor(Math.random()*999);
const userId = user ? user.id.toString() : "guest_" + userName;

let currentRoom = 'elem_chat';
let userData = { balance: 0, bonusBalance: 0, lastBonus: { 1: 0, 2: 0, 3: 0 }, lastGift: 0 };

/* ================= AD ROTATION (IN-APP) ================= */
const inAppOptions = { type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } };
function rotateInApp() {
    show_10337853(inAppOptions);
    setTimeout(() => show_10276123(inAppOptions), 180000);
    setTimeout(() => show_10337795(inAppOptions), 360000);
}
setInterval(rotateInApp, 540000);
rotateInApp();

/* ================= APP LOGIC ================= */
async function init() {
    document.getElementById('userBar').innerText = "👤 " + userName;
    document.getElementById('myCode').innerText = userName;

    const uRef = doc(db, "users", userId);
    const snap = await getDoc(uRef);
    if(!snap.exists()) {
        await setDoc(uRef, { name: userName, balance: 0, bonusBalance: 0, totalEarned: 0, referrer: null, lastSeen: serverTimestamp(), status: 'online' });
    }
    startLiveSync();
}

// 1. CHAT MODULE
window.setRoom = (room) => {
    currentRoom = room;
    const names = { elem_chat: '📘 ELEMENTARY CHAT', high_chat: '📗 HIGHSCHOOL CHAT', coll_chat: '📙 COLLEGE CHAT' };
    document.getElementById('activeRoomName').innerText = names[room];
    loadChat();
};

window.handleMsgSend = async () => {
    const text = document.getElementById('msgInput').value;
    if(!text) return;
    
    Swal.fire({ title: 'Loading 3 Premium Ads...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        await show_10337853(); await show_10337795(); await show_10276123();
        Swal.close();
        if(currentRoom === 'elem_chat') {
            await finishChatAction();
        } else {
            document.getElementById('chatClaimArea').style.display = 'block';
        }
    } catch(e) { Swal.fire("Error", "Ads failed to load", "error"); }
};

window.finishChatAction = async () => {
    const text = document.getElementById('msgInput').value;
    await addDoc(collection(db, currentRoom), { user: userName, text, timestamp: serverTimestamp() });
    await distributeReward(0.015);
    document.getElementById('msgInput').value = '';
    document.getElementById('chatClaimArea').style.display = 'none';
};

// 2. BONUS ADS MODULE
window.runBonus = async (id) => {
    const now = Date.now();
    if(userData.lastBonus[id] && now < userData.lastBonus[id]) {
        return alert("Wait 20 minutes!");
    }
    
    Swal.showLoading();
    await show_10337853(); await show_10337795(); await show_10276123();
    Swal.close();
    
    const uRef = doc(db, "users", userId);
    const update = { balance: increment(0.015), totalEarned: increment(0.015) };
    update[`lastBonus.${id}`] = now + 1200000;
    await updateDoc(uRef, update);
    triggerAnim(0.015);
};

// 3. GIFT MODULE
window.claimGift = async () => {
    const now = Date.now();
    if(userData.lastGift && now < userData.lastGift) return alert("Gift box ready every 2 hours!");
    
    await show_10337853();
    const reward = 0.020;
    await updateDoc(doc(db, "users", userId), { 
        balance: increment(reward), 
        lastGift: now + 7200000 
    });
    triggerAnim(reward);
};

// 4. REFERRALS (8% Sync)
async function distributeReward(amount) {
    const uRef = doc(db, "users", userId);
    await updateDoc(uRef, { balance: increment(amount), totalEarned: increment(amount) });
    
    if(userData.referrer) {
        const bonus = amount * 0.08;
        const q = query(collection(db, "users"), where("name", "==", userData.referrer));
        onSnapshot(q, (snap) => {
            snap.forEach(async (d) => {
                await updateDoc(doc(db, "users", d.id), { bonusBalance: increment(bonus) });
            });
        }, { once: true });
    }
    triggerAnim(amount);
}

// 5. WITHDRAWAL
window.submitWithdraw = async () => {
    const gcash = document.getElementById('wdGcash').value;
    const amt = parseFloat(document.getElementById('wdAmount').value);
    if(amt < 0.02 || amt > userData.balance) return alert("Invalid Amount");
    
    await addDoc(collection(db, "withdrawals"), { 
        userId, name: userName, gcash, amount: amt, status: 'pending', date: serverTimestamp() 
    });
    await updateDoc(doc(db, "users", userId), { balance: increment(-amt) });
    alert("Request Sent!");
};

// 6. OWNER DASHBOARD
window.openOwner = async () => {
    const pass = prompt("Password:");
    if(pass === "Propetas12") showPage('admin');
};

window.approveWd = async (id, amt) => {
    await updateDoc(doc(db, "withdrawals", id), { status: 'approved' });
    await updateDoc(doc(db, "system", "stats"), { totalPaid: increment(amt) });
};

/* ================= LIVE DATA ================= */
function startLiveSync() {
    onSnapshot(doc(db, "users", userId), (snap) => {
        userData = snap.data();
        document.getElementById('balance').innerText = userData.balance.toFixed(3);
        document.getElementById('refBonus').innerText = userData.bonusBalance.toFixed(3);
    });

    onSnapshot(query(collection(db, "users"), where("status", "==", "online"), limit(25)), (snap) => {
        document.getElementById('onlineCount').innerText = snap.size;
        const list = document.getElementById('onlineList');
        list.innerHTML = '';
        snap.forEach(d => list.innerHTML += `<tr><td>${d.data().name}</td><td>🟢 Online</td></tr>`);
    });

    onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(500)), (snap) => {
        const list = document.getElementById('lbList');
        list.innerHTML = '';
        let rank = 1;
        snap.forEach(d => list.innerHTML += `<tr><td>${rank++}</td><td>${d.data().name}</td><td>₱${d.data().totalEarned.toFixed(3)}</td></tr>`);
    });

    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (snap) => {
        const list = document.getElementById('adminWdList');
        list.innerHTML = '';
        snap.forEach(d => {
            const data = d.data();
            list.innerHTML += `<div class="card">${data.name} | ₱${data.amount}<br>${data.gcash}
            <button class="btn-main btn-blue" onclick="approveWd('${d.id}', ${data.amount})">APPROVE</button></div>`;
        });
    });

    onSnapshot(doc(db, "system", "stats"), (snap) => {
        document.getElementById('adminTotal').innerText = snap.data()?.totalPaid.toFixed(2) || "0.00";
    });
}

function triggerAnim(amt) {
    const styles = ['animate__bounceIn', 'animate__flipInX', 'animate__zoomIn', 'animate__backInDown', 'animate__jackInTheBox'];
    Swal.fire({
        title: `+₱${amt}`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        showClass: { popup: `animate__animated ${styles[Math.floor(Math.random()*styles.length)]}` }
    });
}

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('inputBar').style.display = (id === 'chat') ? 'flex' : 'none';
};

init();
