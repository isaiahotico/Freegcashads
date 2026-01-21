import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, query, where, orderBy, limit,
  onSnapshot, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads"
});
const db = getFirestore(app);

/* TELEGRAM */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const username = user ? `@${user.username||user.first_name}` : "Guest";
userBar.innerText = "👤 "+username;

/* USER INIT */
const userRef = doc(db,"users",username);
const snap = await getDoc(userRef);
if(!snap.exists()){
  await setDoc(userRef,{
    username,balance:0,locked:0,online:true,createdAt:serverTimestamp()
  });
}

/* LIVE BALANCE */
onSnapshot(userRef,s=>{
  balance.innerText = `💰 ₱${(s.data().balance||0).toFixed(3)}`;
});

/* ONLINE USERS */
onSnapshot(
  query(collection(db,"users"),where("online","==",true),limit(25)),
  s=>{
    onlineList.innerHTML="";
    s.forEach(d=>{
      onlineList.innerHTML+=`<div class="card">${d.id}</div>`;
    });
  }
);

/* WITHDRAW */
window.requestWithdraw = async ()=>{
  const amt = parseFloat(amount.value);
  if(amt<0.02) return alert("Minimum 0.02");
  await addDoc(collection(db,"withdrawals"),{
    username,
    gcash:gcash.value,
    amount:amt,
    status:"pending",
    requestedAt:serverTimestamp()
  });
};

/* WITHDRAW HISTORY */
onSnapshot(
  query(collection(db,"withdrawals"),where("username","==",username),orderBy("requestedAt","desc"),limit(25)),
  s=>{
    withdrawHistory.innerHTML="";
    s.forEach(d=>{
      const w=d.data();
      withdrawHistory.innerHTML+=
        `<div class="card">${w.amount} • ${w.status}</div>`;
    });
  }
);

/* OWNER */
window.ownerLogin=()=>{
  if(ownerPass.value!=="Propetas12")return alert("Denied");
  onSnapshot(
    query(collection(db,"withdrawals"),orderBy("requestedAt","desc"),limit(25)),
    s=>{
      ownerWithdrawals.innerHTML="";
      s.forEach(d=>{
        ownerWithdrawals.innerHTML+=
          `<div class="card">${d.data().username} ₱${d.data().amount}</div>`;
      });
    }
  );
};
