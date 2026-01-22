import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, addDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------- FIREBASE ---------- */
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

/* ---------- TELEGRAM ---------- */
Telegram.WebApp.ready();
Telegram.WebApp.expand();

const tgUser = Telegram.WebApp.initDataUnsafe.user;
const uid = tgUser.id.toString();
const username = tgUser.username || tgUser.first_name;

/* ---------- UI ---------- */
document.getElementById("username").innerText = username;

/* ---------- USER INIT ---------- */
const userRef = doc(db, "users", uid);
const userSnap = await getDoc(userRef);
if (!userSnap.exists()) {
  await setDoc(userRef, { balance: 0, username });
}
document.getElementById("balance").innerText =
  (await getDoc(userRef)).data().balance;

/* ---------- REQUEST WITHDRAW ---------- */
window.requestWithdraw = async () => {
  const name = gcashName.value;
  const number = gcashNumber.value;
  const amount = Number(withdrawAmount.value);

  if (!name || !number || amount <= 0) {
    alert("Fill all fields");
    return;
  }

  await addDoc(collection(db, "withdrawals"), {
    uid,
    username,
    name,
    number,
    amount,
    status: "PENDING",
    createdAt: Date.now()
  });

  alert("⏳ Withdrawal requested");
};

/* ---------- USER WITHDRAW HISTORY (LIVE) ---------- */
onSnapshot(
  query(collection(db, "withdrawals"), orderBy("createdAt", "desc")),
  snap => {
    withdrawTable.innerHTML = "";
    snap.forEach(docu => {
      const d = docu.data();
      if (d.uid !== uid) return;

      withdrawTable.innerHTML += `
        <tr>
          <td>${new Date(d.createdAt).toLocaleString()}</td>
          <td>${d.number}</td>
          <td>${d.amount}</td>
          <td class="${d.status.toLowerCase()}">${d.status}</td>
        </tr>
      `;
    });
  }
);

/* ---------- ADMIN ---------- */
window.openAdmin = () => {
  if (adminPass.value !== "Propetas6") {
    alert("Wrong password");
    return;
  }
  adminPanel.style.display = "block";
};

/* ---------- ADMIN LIVE DASHBOARD ---------- */
onSnapshot(
  query(collection(db, "withdrawals"), orderBy("createdAt", "desc")),
  snap => {
    adminWithdrawTable.innerHTML = "";
    snap.forEach(docu => {
      const d = docu.data();
      adminWithdrawTable.innerHTML += `
        <tr>
          <td>${d.username}</td>
          <td>${d.number}</td>
          <td>${d.amount}</td>
          <td class="${d.status.toLowerCase()}">${d.status}</td>
          <td>
            <button onclick="updateStatus('${docu.id}','APPROVED')">✅</button>
            <button onclick="updateStatus('${docu.id}','REJECTED')">❌</button>
          </td>
        </tr>
      `;
    });
  }
);

window.updateStatus = async (id, status) => {
  await updateDoc(doc(db, "withdrawals", id), { status });
};
