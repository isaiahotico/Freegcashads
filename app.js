import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase, ref, push, onValue, update, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* Firebase */
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* REAL TELEGRAM USERNAME (NO GUEST) */
let tg = Telegram.WebApp.initDataUnsafe.user;
let username =
  tg.username ||
  `${tg.first_name || ""} ${tg.last_name || ""}`.trim() + ` (${tg.id})`;

tgUser.innerText = "Telegram: @" + username;

/* Balance (LIVE) */
const balanceRef = ref(db, "balances/" + username);
runTransaction(balanceRef, bal => bal ?? 500000);
onValue(balanceRef, snap => {
  balance.innerText = "₱" + (snap.val() || 0);
});

/* Withdraw */
window.requestWithdraw = () => {
  const amt = Number(amount.value);
  if (!amt || !gcash.value) return alert("Complete fields");

  push(ref(db, "withdrawals"), {
    user: username,
    gcash: gcash.value,
    amount: amt,
    status: "PENDING",
    time: Date.now()
  });

  alert("Wait for a moment, please monitor status in your withdrawal history.");
};

/* USER HISTORY — SNAPSHOT LISTENER */
onValue(ref(db, "withdrawals"), snap => {
  history.innerHTML = "";
  snap.forEach(c => {
    const d = c.val();
    if (d.user === username) {
      history.innerHTML += `
        <tr>
          <td>₱${d.amount}</td>
          <td>${d.status}</td>
          <td>${new Date(d.time).toLocaleString()}</td>
        </tr>`;
    }
  });
});

/* ADMIN */
window.openAdmin = () => admin.style.display = "block";
window.closeAdmin = () => admin.style.display = "none";
window.loginAdmin = () => {
  if (adminPass.value === "Propetas12") adminPanel.style.display = "block";
  else alert("Wrong password");
};

/* OWNER DASHBOARD + LIVE STATS */
onValue(ref(db, "withdrawals"), snap => {
  adminList.innerHTML = "";
  let pending = 0, approved = 0;

  snap.forEach(c => {
    const d = c.val();
    if (d.status === "PENDING") pending++;
    if (d.status === "APPROVED") approved++;

    adminList.innerHTML += `
      <tr>
        <td>@${d.user}</td>
        <td>${d.gcash}</td>
        <td>₱${d.amount}</td>
        <td>${d.status}</td>
        <td>${new Date(d.time).toLocaleString()}</td>
        <td>
          ${d.status === "PENDING"
            ? `<button onclick="approve('${c.key}','${d.user}',${d.amount})">Approve</button>`
            : "-"}
        </td>
      </tr>`;
  });

  stats.innerText = `Pending: ${pending} | Approved: ${approved}`;
});

/* APPROVE + BALANCE DEDUCTION (ATOMIC) */
window.approve = (id, user, amt) => {
  update(ref(db, "withdrawals/" + id), { status: "APPROVED" });

  runTransaction(ref(db, "balances/" + user), bal => {
    if (bal === null) return bal;
    return bal - amt;
  });
};
