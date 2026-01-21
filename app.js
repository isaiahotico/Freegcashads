
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, addDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let userData = { balance: 0, totalEarned: 0, username: "" };
let dailyLinks = { link1: "", link2: "" };

// --- AUTH & INITIALIZATION ---
signInAnonymously(auth);
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            userData.username = "@user_" + Math.floor(Math.random() * 9999);
            await setDoc(userRef, { ...userData, uid: user.uid });
        } else {
            userData = snap.data();
        }
        document.getElementById('display-username').innerText = userData.username;
        syncData();
    }
});

function syncData() {
    onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => {
        userData = doc.data();
        document.getElementById('bal-val').innerText = userData.balance.toFixed(3);
    });
    
    // Sync Links
    onSnapshot(doc(db, "config", "daily_links"), (doc) => {
        if(doc.exists()) dailyLinks = doc.data();
    });

    // Sync Elementary Chat
    const qElem = query(collection(db, "chats_elem"), orderBy("time", "desc"), limit(50));
    onSnapshot(qElem, (s) => {
        const cont = document.getElementById('elem-chat-content');
        cont.innerHTML = s.docs.map(d => `<tr><td class="text-blue-400 font-bold">${d.data().user}:</td><td>${d.data().msg}</td></tr>`).join('');
    });

    // Sync Highschool Chat
    const qHigh = query(collection(db, "chats_high"), orderBy("time", "desc"), limit(50));
    onSnapshot(qHigh, (s) => {
        const cont = document.getElementById('hs-chat-content');
        cont.innerHTML = s.docs.map(d => `<tr><td class="text-green-400 font-bold">${d.data().user}:</td><td>${d.data().msg}</td></tr>`).join('');
    });
}

// --- NAVIGATION ---
window.showPage = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-high') startHSTimer();
    if(id === 'page-leaderboard') loadLeaderboard();
};

// --- ELEMENTARY LOGIC ---
window.sendElemChat = async () => {
    const msg = document.getElementById('elem-input').value;
    if(!msg) return;
    
    // Show 3 Ads
    try {
        await show_10276123(); await show_10337795(); await show_10337853();
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, { balance: userData.balance + 0.015, totalEarned: userData.totalEarned + 0.015 });
        await addDoc(collection(db, "chats_elem"), { user: userData.username, msg, time: serverTimestamp() });
        document.getElementById('elem-input').value = "";
    } catch(e) { alert("Complete ads to send!"); }
};

// --- HIGHSCHOOL LOGIC ---
function startHSTimer() {
    const btn = document.getElementById('hs-claim-btn');
    btn.classList.add('hidden');
    setTimeout(() => btn.classList.remove('hidden'), 240000); // 4 min
}

window.claimHighSchool = async () => {
    const msg = document.getElementById('hs-input').value;
    if(!msg) return alert("Type message first");
    const userRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(userRef, { balance: userData.balance + 0.015, totalEarned: userData.totalEarned + 0.015 });
    await addDoc(collection(db, "chats_high"), { user: userData.username, msg, time: serverTimestamp() });
    document.getElementById('hs-input').value = "";
    startHSTimer();
};

// --- DAILY LOGIN LOGIC ---
window.runDailyTask = (num) => {
    const link = num === 1 ? dailyLinks.link1 : dailyLinks.link2;
    window.open(link, '_blank');
    const btn = document.getElementById(`task${num}-btn`);
    btn.innerText = "WAITING 9s...";
    btn.disabled = true;
    
    setTimeout(async () => {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, { balance: userData.balance + 0.01, totalEarned: userData.totalEarned + 0.01 });
        btn.innerText = "COMPLETED";
        alert("₱0.01 Added!");
    }, 9000);
};

// --- LEADERBOARD LOGIC ---
async function loadLeaderboard() {
    const q = query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(500));
    onSnapshot(q, (s) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = s.docs.map((d, i) => `<tr><td class="p-2">${i+1}</td><td>${d.data().username}</td><td class="text-yellow-500">₱${d.data().totalEarned.toFixed(2)}</td></tr>`).join('');
    });
}

// --- WITHDRAWAL LOGIC ---
window.submitWithdraw = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const num = document.getElementById('wd-number').value;
    if(amt < 0.015 || userData.balance < amt) return alert("Invalid Amount");

    const userRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(userRef, { balance: userData.balance - amt });
    await addDoc(collection(db, "withdrawals"), { 
        uid: auth.currentUser.uid, 
        user: userData.username, 
        amount: amt, 
        gcash: num, 
        status: "Pending", 
        date: new Date().toLocaleString() 
    });
    alert("Request Sent!");
};

// --- OWNER LOGIC ---
window.loginOwner = () => {
    if(document.getElementById('owner-pass').value === "Propetas12") {
        document.getElementById('owner-auth').classList.add('hidden');
        document.getElementById('owner-panel').classList.remove('hidden');
        loadOwnerData();
    }
};

function loadOwnerData() {
    onSnapshot(collection(db, "withdrawals"), (s) => {
        const list = document.getElementById('owner-wd-list');
        list.innerHTML = s.docs.map(d => `
            <tr class="border-b border-white/10">
                <td>${d.data().user}</td>
                <td>₱${d.data().amount}</td>
                <td>${d.data().gcash}</td>
                <td>${d.data().date}</td>
                <td>
                    <button onclick="updateWD('${d.id}', 'Approve')" class="text-green-400 mr-2">Approve</button>
                    <button onclick="updateWD('${d.id}', 'Cancelled')" class="text-red-400">Cancel</button>
                </td>
            </tr>`).join('');
    });
}

window.updateWD = async (id, status) => {
    await updateDoc(doc(db, "withdrawals", id), { status });
};

// --- ADMIN LINKS ---
window.checkAdminLinks = () => {
    const p = prompt("Password:");
    if(p === "Propetas12") showPage('page-admin-links');
};

window.saveLinks = async () => {
    await setDoc(doc(db, "config", "daily_links"), {
        link1: document.getElementById('link1-input').value,
        link2: document.getElementById('link2-input').value
    });
    alert("Links Updated!");
    showPage('page-main');
};
