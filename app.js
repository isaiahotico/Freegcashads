
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, addDoc,
  collection, query, where, orderBy, limit,
  onSnapshot, updateDoc, serverTimestamp, startAfter, limitToLast
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- TELEGRAM SETUP ---
const tg = window.Telegram.WebApp;
tg.expand();
const tgUser = tg.initDataUnsafe.user;
const uid = tgUser ? (tgUser.username || `user_${tgUser.id}`) : "Guest";
document.getElementById("display-username").innerText = uid;

// --- STATE ---
let currentBalance = 0;
let lastMsgTime = localStorage.getItem('lastMsgTime') || 0;
const userRef = doc(db, "users", uid);

// --- INITIALIZE USER & LIVE BALANCE ---
async function init() {
    await setDoc(userRef, { balance: 0 }, { merge: true });
    onSnapshot(userRef, snap => {
        if(snap.exists()){
            currentBalance = snap.data().balance || 0;
            document.getElementById("balance").innerText = currentBalance.toFixed(3);
        }
    });
}
init();

// --- THEME ENGINE ---
const colors = ["pink", "green", "blue", "red", "violet", "yellow", "yellowgreen", "orange", "white", "cyan", "brown", "bricks"];
document.getElementById('aide-text').onclick = () => {
    const body = document.getElementById('mainBody');
    const color = colors[Math.floor(Math.random() * colors.length)];
    body.className = ""; body.style.backgroundColor = ""; body.style.color = "white";
    if(color === 'bricks') body.classList.add('bricks');
    else {
        body.style.backgroundColor = color;
        if(['white','yellow','cyan','yellowgreen'].includes(color)) body.style.color = "black";
    }
};

// --- CHAT LOGIC ---
window.handleSendMessage = async () => {
    const text = document.getElementById("chatInput").value.trim();
    const now = Date.now();
    if(!text) return;
    if(now - lastMsgTime < 180000) return alert("Please wait 3 minutes cooldown.");

    try {
        // Sequentially show 3 Rewarded Interstitials
        tg.MainButton.setText("WATCHING AD 1/3...").show();
        await show_10337853();
        tg.MainButton.setText("WATCHING AD 2/3...");
        await show_10337795();
        tg.MainButton.setText("WATCHING AD 3/3...");
        await show_10276123();
        tg.MainButton.hide();

        // Update Balance & Send
        const newBal = currentBalance + 0.015;
        await updateDoc(userRef, { balance: newBal });
        await addDoc(collection(db, "messages"), {
            user: uid,
            text: text,
            createdAt: serverTimestamp()
        });
        
        lastMsgTime = now;
        localStorage.setItem('lastMsgTime', now);
        document.getElementById("chatInput").value = "";
    } catch (e) {
        alert("Ad interrupted. Watch all 3 ads to send.");
        tg.MainButton.hide();
    }
};

// Chat Listener
onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(50)), snap => {
    const box = document.getElementById("chat-box");
    box.innerHTML = snap.docs.map(d => `
        <div class="msg"><b>${d.data().user}</b>${d.data().text}</div>
    `).join("");
});

// --- WITHDRAWAL LOGIC ---
window.requestWithdraw = async () => {
  const name = document.getElementById("gcashName").value.trim();
  const num = document.getElementById("gcashNumber").value.trim();
  const amt = Number(document.getElementById("amount").value);

  if (!name || !num || amt < 5) return alert("Min withdrawal ₱5. Fill all fields.");
  if (amt > currentBalance) return alert("Insufficient balance.");

  // AUTO DEDUCT
  await updateDoc(userRef, { balance: currentBalance - amt });

  await addDoc(collection(db, "withdrawals"), {
    user: uid,
    gcashName: name,
    gcashNumber: num,
    amount: amt,
    status: "pending",
    rejectReason: "",
    createdAt: serverTimestamp()
  });

  alert("Submitted! Balance deducted.");
};

// Pagination & User History
onSnapshot(query(collection(db, "withdrawals"), where("user", "==", uid), orderBy("createdAt", "desc"), limit(10)), snap => {
    document.getElementById("userWithdrawals").innerHTML = snap.docs.map(d => {
        const w = d.data();
        return `<tr><td>₱${w.amount}</td><td>${w.gcashNumber}</td><td>${w.status}</td><td>${w.rejectReason || "-"}</td></tr>`;
    }).join("");
});

// --- OWNER DASHBOARD ---
window.checkAdmin = () => showPage('admin-page');

window.loginAdmin = () => {
    if(document.getElementById("adminPass").value === "Propetas6") {
        document.getElementById("admin-auth").style.display = "none";
        document.getElementById("admin-content").style.display = "block";
        loadAdminTable();
    } else alert("Wrong Password");
};

function loadAdminTable() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), snap => {
        document.getElementById("adminTable").innerHTML = snap.docs.map(d => {
            const w = d.data();
            return `<tr>
                <td>${w.user}</td>
                <td>₱${w.amount}</td>
                <td>${w.gcashNumber}</td>
                <td>
                    <button onclick="approve('${d.id}')" style="background:green">✔</button>
                    <button onclick="reject('${d.id}')" style="background:red">✖</button>
                </td>
            </tr>`;
        }).join("");
    });
}

window.approve = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
};

window.reject = async (id) => {
    const reason = prompt("Reason for rejection?");
    if(reason) {
        // Return money on rejection? Optional.
        await updateDoc(doc(db, "withdrawals", id), { status: "rejected", rejectReason: reason });
    }
};

// --- GLOBAL UTILS ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'chat-page') document.getElementById('nav-chat').classList.add('active');
    if(id === 'withdraw-page') document.getElementById('nav-withdraw').classList.add('active');
};

setInterval(() => {
    document.getElementById("time-display").innerText = new Date().toLocaleString();
}, 1000);
