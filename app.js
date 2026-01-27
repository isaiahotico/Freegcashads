
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, addDoc, increment, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// User Setup
const tg = window.Telegram.WebApp;
const username = tg.initDataUnsafe?.user?.username || "Guest_" + Math.floor(Math.random()*1000);
let userData = {};

async function init() {
    document.getElementById('display-username').innerText = "@" + username;
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if(!snap.exists()) {
        await setDoc(userRef, { username, balance: 0, points: 5, referrer: "", totalRefEarnings: 0 });
    }

    // Live User Sync
    onSnapshot(userRef, (d) => {
        userData = d.data();
        document.getElementById('user-balance').innerText = userData.balance.toFixed(3);
        document.getElementById('user-points').innerText = userData.points;
        document.getElementById('total-ref-earning').innerText = (userData.totalRefEarnings || 0).toFixed(2);
    });

    loadChat();
    loadLeaderboard();
    loadPayouts();
}

// Tab Management
window.showTab = (name) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(name + '-view').classList.add('active');
    document.getElementById('nav-' + name).classList.add('active');
};

// Ads Logic
window.watchVideoAd = () => {
    if(onCD('video')) return;
    show_10276123().then(async () => {
        await updateDoc(doc(db, "users", username), { points: increment(1) });
        startCD('video', 20, 'vid-btn');
    });
};

window.watchPopupAd = () => {
    if(onCD('popup')) return;
    show_10276123('pop').then(async () => {
        await updateDoc(doc(db, "users", username), { points: increment(1) });
        startCD('popup', 20, 'pop-btn');
    });
};

// Chat Logic
window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if(!msg || userData.points < 1 || onCD('chat')) return;

    show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0, interval: 5, timeout: 0, everyPage: true } });

    await addDoc(collection(db, "chat"), { username, text: msg, time: serverTimestamp() });
    await updateDoc(doc(db, "users", username), { balance: increment(0.015), points: increment(-1) });

    if(userData.referrer) {
        const refRef = doc(db, "users", userData.referrer);
        await updateDoc(refRef, { balance: increment(0.015 * 0.08), totalRefEarnings: increment(0.015 * 0.08) });
    }

    input.value = "";
    startCD('chat', 45, 'chat-send-btn');
};

function loadChat() {
    const q = query(collection(db, "chat"), orderBy("time", "desc"), limit(30));
    onSnapshot(q, (s) => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = "";
        s.docs.reverse().forEach(d => {
            const m = d.data();
            const isMe = m.username === username;
            box.innerHTML += `<div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                <div class="${isMe ? 'bg-amber-100' : 'bg-gray-100'} p-3 rounded-2xl max-w-[80%] shadow-sm">
                    <p class="text-[9px] font-black text-amber-600 uppercase">@${m.username}</p>
                    <p class="text-xs text-gray-800">${m.text}</p>
                </div>
            </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// Withdrawal Logic
window.handleWithdrawal = async () => {
    const name = document.getElementById('gcash-name').value;
    const num = document.getElementById('gcash-number').value;
    if(!name || num.length < 10) return alert("Fill all details correctly");
    if(userData.balance < 1.0) return alert("Minimum ₱1.00 required");

    const amount = userData.balance;
    await updateDoc(doc(db, "users", username), { balance: 0 });
    await addDoc(collection(db, "withdrawals"), {
        username, name, gcash: num, amount, status: "Pending", time: serverTimestamp()
    });
    alert("Request Submitted!");
};

function loadPayouts() {
    const q = query(collection(db, "withdrawals"), orderBy("time", "desc"), limit(10));
    onSnapshot(q, (s) => {
        const history = document.getElementById('payout-history');
        history.innerHTML = "";
        s.docs.forEach(d => {
            const p = d.data();
            const date = p.time ? new Date(p.time.seconds*1000).toLocaleDateString() : 'Just now';
            history.innerHTML += `<div class="flex justify-between items-center text-[11px] border-b pb-2">
                <div><p class="font-bold">₱${p.amount.toFixed(2)} to ${p.gcash}</p><p class="text-gray-400">${date}</p></div>
                <div class="font-black ${p.status === 'Paid' ? 'text-green-600' : 'text-orange-500'}">${p.status}</div>
            </div>`;
        });
    });
}

// Owner Logic
window.loginOwner = () => {
    if(document.getElementById('owner-pass').value === "Propetas12") {
        document.getElementById('owner-auth').classList.add('hidden');
        document.getElementById('owner-panel').classList.remove('hidden');
        loadOwnerRequests();
    }
};

function loadOwnerRequests() {
    const q = query(collection(db, "withdrawals"), orderBy("time", "desc"));
    onSnapshot(q, (s) => {
        const list = document.getElementById('owner-request-list');
        list.innerHTML = "";
        s.docs.forEach(d => {
            const r = d.data();
            if(r.status === "Pending") {
                list.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-red-500">
                    <p class="text-xs font-black">@${r.username} (${r.name})</p>
                    <p class="text-sm font-bold text-blue-600">₱${r.amount.toFixed(2)} - ${r.gcash}</p>
                    <button onclick="approvePayout('${d.id}')" class="mt-2 w-full bg-green-500 text-white py-2 rounded-xl text-xs font-bold">APPROVE & PAY</button>
                </div>`;
            }
        });
    });
}

window.approvePayout = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "Paid" });
};

// Utils
function loadLeaderboard() {
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(10));
    onSnapshot(q, (s) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        let i = 1;
        s.docs.forEach(d => {
            const u = d.data();
            list.innerHTML += `<div class="flex justify-between p-3 bg-gray-50 rounded-2xl text-xs">
                <span><b>#${i++}</b> @${u.username}</span>
                <span class="font-black text-blue-600">₱${u.balance.toFixed(2)}</span>
            </div>`;
        });
    });
}

window.saveReferrer = async () => {
    const ref = document.getElementById('ref-input').value.trim();
    if(ref === username) return alert("Invalid Referrer");
    const check = await getDoc(doc(db, "users", ref));
    if(check.exists()) {
        await updateDoc(doc(db, "users", username), { referrer: ref });
        alert("Referrer Linked!");
    } else alert("User not found");
};

function startCD(type, sec, id) {
    const el = document.getElementById(id);
    el.classList.add('cooldown');
    const expiry = Date.now() + (sec * 1000);
    localStorage.setItem('cd_'+type, expiry);
    let t = setInterval(() => {
        const rem = Math.ceil((expiry - Date.now()) / 1000);
        if(type === 'chat') document.getElementById('chat-cd-msg').innerText = "Cooldown: " + rem + "s";
        if(rem <= 0) { 
            clearInterval(t); 
            el.classList.remove('cooldown'); 
            if(type === 'chat') document.getElementById('chat-cd-msg').innerText = "";
        }
    }, 1000);
}

function onCD(type) {
    const exp = localStorage.getItem('cd_'+type);
    if(exp && Date.now() < exp) return true;
    return false;
}

init();
