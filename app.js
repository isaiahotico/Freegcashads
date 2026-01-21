import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase, ref, push, onValue, update, get
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* Firebase Config */
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

/* Telegram User */
let user = "guest";
if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
  user = Telegram.WebApp.initDataUnsafe.user.username ||
         Telegram.WebApp.initDataUnsafe.user.first_name;
}
tgUser.innerText = "Telegram: @" + user;

/* Balance */
const balanceRef = ref(db, "balances/" + user);
get(balanceRef).then(s => {
  if (!s.exists()) update(ref(db, "balances"), { [user]: 500000 });
});
onValue(balanceRef, s => {
  balance.innerText = "₱" + (s.val() || 0);
});

/* Withdraw */
window.requestWithdraw = () => {
  const amt = Number(amount.value);
  if (!amt || !gcash.value) return alert("Complete fields");
  push(ref(db, "withdrawals"), {
    user,
    amount: amt,
    gcash: gcash.value,
    status: "PENDING",
    time: Date.now()
  });
};

/* Pagination */
let page = 0, size = 5;
window.nextPage = () => page++;
window.prevPage = () => page = Math.max(0, page - 1);

/* User History */
onValue(ref(db, "withdrawals"), snap => {
  let list = [];
  snap.forEach(c => {
    if (c.val().user === user) list.push(c.val());
  });
  list.sort((a, b) => b.time - a.time);
  history.innerHTML = "";
  list.slice(page * size, (page + 1) * size).forEach(d => {
    history.innerHTML += `<tr><td>₱${d.amount}</td><td>${d.status}</td></tr>`;
  });
});

/* Admin */
window.openAdmin = () => admin.style.display = "block";
window.closeAdmin = () => admin.style.display = "none";
window.loginAdmin = () => {
  if (adminPass.value === "Propetas12") adminPanel.style.display = "block";
  else alert("Wrong password");
};

/* Admin Dashboard */
onValue(ref(db, "withdrawals"), snap => {
  pending.innerHTML = approved.innerHTML = rejected.innerHTML = "";
  let p = 0, a = 0, r = 0;

  snap.forEach(c => {
    const d = c.val();
    if (d.status === "PENDING") {
      p++;
      pending.innerHTML += `
        <tr>
          <td>${d.user}</td>
          <td>₱${d.amount}</td>
          <td>
            <button onclick="approve('${c.key}',${d.amount},'${d.user}')">Approve</button>
          </td>
        </tr>`;
    }
    if (d.status === "APPROVED") {
      a++;
      approved.innerHTML += `<tr><td>${d.user}</td><td>₱${d.amount}</td></tr>`;
    }
    if (d.status === "REJECTED") {
      r++;
      rejected.innerHTML += `<tr><td>${d.user}</td><td>₱${d.amount}</td></tr>`;
    }
  });

  stats.innerText = `Pending: ${p} | Approved: ${a} | Rejected: ${r}`;
});

/* Approve + Deduct Balance */
window.approve = (id, amt, u) => {
  update(ref(db, "withdrawals/" + id), { status: "APPROVED" });
  get(ref(db, "balances/" + u)).then(s => {
    update(ref(db, "balances/" + u), { ".value": (s.val() || 0) - amt });
  });
};
