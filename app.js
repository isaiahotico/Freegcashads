
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

let userData = { balance: 0, totalEarned: 0, username: "Guest" };
let dailyLinks = { link1: "", link2: "" };
let lastElemSend = 0;

// --- TELEGRAM & AUTH ---
const tg = window.Telegram.WebApp;
tg.expand();

signInAnonymously(auth);
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const tgUser = tg.initDataUnsafe?.user?.username || "user_" + user.uid.slice(0, 5);
        userData.username = "@" + tgUser;
        document.getElementById('tg-username').innerText = userData.username;
        document.getElementById('ref-code-display').innerText = "PH-" + user.uid.slice(0, 6);

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            await setDoc(userRef, { ...userData, uid: user.uid });
        } else {
            userData = snap.data();
        }
        syncLive();
    }
});

function syncLive() {
    onSnapshot(doc(db, "users", auth.currentUser.uid), (d) => {
        userData = d.data();
        document.getElementById('bal-val').innerText = userData.balance.toFixed(3);
    });

    onSnapshot(doc(db, "config", "daily_links"), (d) => {
        if(d.exists()) dailyLinks = d.data();
    });

    onSnapshot(query(collection(db, "chats_elem"), orderBy("time", "desc"), limit(50)), (s) => {
        document.getElementById('elem-chat-content').innerHTML = s.docs.map(d => `<div class="bg-white/5 p-3 rounded-xl border border-white/5"><span class="text-blue-400 font-bold block text-[10px]">${d.data().user}</span><p class="text-sm">${d.data().msg}</p></div>`).join('');
    });

    onSnapshot(query(collection(db, "chats_high"), orderBy("time", "desc"), limit(50)), (s) => {
        document.getElementById('hs-chat-content').innerHTML = s.docs.map(d => `<div class="bg-white/5 p-3 rounded-xl mb-2"><span class="text-green-400 font-bold text-[10px]">${d.data().user}: </span>${d.data().msg}</div>`).join('');
    });

    onSnapshot(query(collection(db, "withdrawals"), orderBy("date", "desc"), limit(10)), (s) => {
        document.getElementById('wd-history').innerHTML = s.docs.map(d => `<div class="glass p-3 flex justify-between text-[10px]"><span>${d.data().gcash}</span><span class="font-bold">₱${d.data().amount}</span><span class="${d.data().status === 'Approve' ? 'text-green-400' : 'text-yellow-400'}">${d.data().status}</span></div>`).join('');
    });
}

// --- NAVIGATION ---
window.nav = (id) => {
    document.querySelectorAll('section, main').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-high') startHSTimer();
    if(id === 'page-leaderboard') loadLeaderboard();
};

// --- ELEMENTARY: 3 ADS + COOLDOWN ---
window.sendElemMsg = async () => {
    const now = Date.now();
    if (now - lastElemSend < 180000) return alert("Wait 3 mins!");
    const msg = document.getElementById('elem-input').value;
    if(!msg) return;

    try {
        await show_10276123(); await show_10337795(); await show_10337853();
        await updateDoc(doc(db, "users", auth.currentUser.uid), { balance: userData.balance + 0.015, totalEarned: userData.totalEarned + 0.015 });
        await addDoc(collection(db, "chats_elem"), { user: userData.username, msg, time: serverTimestamp() });
        document.getElementById('elem-input').value = "";
        lastElemSend = now;
    } catch(e) { alert("Watch all ads!"); }
};

// --- HIGHSCHOOL: 4 MIN COOLDOWN ---
function startHSTimer() {
    const btn = document.getElementById('hs-claim-btn');
    btn.classList.add('hidden');
    setTimeout(() => btn.classList.remove('hidden'), 240000); 
}

window.claimHS = async () => {
    const msg = document.getElementById('hs-input').value;
    if(!msg) return alert("Enter message!");
    await updateDoc(doc(db, "users", auth.currentUser.uid), { balance: userData.balance + 0.015, totalEarned: userData.totalEarned + 0.015 });
    await addDoc(collection(db, "chats_high"), { user: userData.username, msg, time: serverTimestamp() });
    document.getElementById('hs-input').value = "";
    startHSTimer();
};

// --- DAILY TASKS ---
window.dailyTask = (n) => {
    const link = n === 1 ? dailyLinks.link1 : dailyLinks.link2;
    window.open(link, '_blank');
    const b = document.getElementById(`d-btn-${n}`);
    b.disabled = true; b.innerText = "WAITING 9S...";
    setTimeout(async () => {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { balance: userData.balance + 0.01, totalEarned: userData.totalEarned + 0.01 });
        b.innerText = "DONE!";
    }, 9000);
};

// --- LEADERBOARD ---
async function loadLeaderboard() {
    onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(500)), (s) => {
        document.getElementById('leaderboard-list').innerHTML = s.docs.map((d, i) => `<tr class="border-b border-white/5"><td class="p-3 opacity-50">${i+1}</td><td class="p-3">${d.data().username}</td><td class="p-3 text-yellow-500 font-bold">₱${d.data().totalEarned.toFixed(2)}</td></tr>`).join('');
    });
}

// --- WITHDRAW ---
window.submitWithdraw = async () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const g = document.getElementById('wd-num').value;
    if(amt < 0.015 || userData.balance < amt) return alert("Check balance/min");
    await updateDoc(doc(db, "users", auth.currentUser.uid), { balance: userData.balance - amt });
    await addDoc(collection(db, "withdrawals"), { user: userData.username, amount: amt, gcash: g, status: "Pending", date: Date.now() });
    alert("Request Live!");
};

// --- OWNER & ADMIN ---
window.authOwner = () => {
    if(document.getElementById('owner-pass').value === "Propetas12") {
        document.getElementById('owner-login').classList.add('hidden');
        document.getElementById('owner-panel').classList.remove('hidden');
        onSnapshot(collection(db, "withdrawals"), (s) => {
            document.getElementById('owner-list').innerHTML = s.docs.map(d => `<tr><td>${d.data().user}</td><td>${d.data().amount}</td><td>${d.data().gcash}</td><td><button onclick="ownerApprove('${d.id}')" class="text-green-500">OK</button></td></tr>`).join('');
        });
    }
};
window.ownerApprove = async (id) => { await updateDoc(doc(db, "withdrawals", id), { status: "Approve" }); };

window.checkAdminLinks = () => { if(prompt("Pass:") === "Propetas12") nav('page-admin-links'); };
window.saveLinks = async () => {
    await setDoc(doc(db, "config", "daily_links"), { link1: document.getElementById('link1-in').value, link2: document.getElementById('link2-in').value });
    alert("Saved!"); nav('main-menu');
};
