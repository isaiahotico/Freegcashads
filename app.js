import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  addDoc, collection, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* FIREBASE */
const app = initializeApp({
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads"
});
const db = getFirestore(app);

/* TELEGRAM */
const tg = window.Telegram.WebApp;
tg.ready();
const u = tg.initDataUnsafe.user;
const uid = String(u.id);
const uname = `@${u.username || u.first_name}`;
userBar.innerText = "👤 " + uname;

/* USER */
const userRef = doc(db,"users",uid);
if(!(await getDoc(userRef)).exists()){
  await setDoc(userRef,{
    username:uname,
    balance:0,
    createdAt:serverTimestamp()
  });
}

onSnapshot(userRef,s=>{
  balance.innerText = (Number(s.data().balance)||0).toFixed(2);
});

/* PAGE */
window.show = id =>{
  document.querySelectorAll(".card").forEach(c=>c.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
};

/* ADS BONUS */
const BONUS = 0.01;
const COOLDOWN = 60*60*1000;

window.claimBonus = async n =>{
  const ref = doc(db,"bonuses",`${uid}_${n}`);
  const snap = await getDoc(ref);

  if(snap.exists()){
    const last = snap.data().last?.toMillis();
    if(Date.now()-last < COOLDOWN){
      bonusMsg.innerText="⏳ Bonus cooldown 1 hour";
      return;
    }
  }

  const us = await getDoc(userRef);
  await updateDoc(userRef,{
    balance:(Number(us.data().balance)||0)+BONUS
  });
  await setDoc(ref,{last:serverTimestamp()});
  bonusMsg.innerText="✅ ₱0.01 added";
};

/* WITHDRAW */
window.requestWithdraw = async ()=>{
  const amt = Number(amount.value);
  const us = await getDoc(userRef);
  if(amt<0.02||amt>us.data().balance) return alert("Invalid amount");

  await addDoc(collection(db,"withdrawals"),{
    uid,username:uname,gcash:gcash.value,
    amount:amt,status:"pending",
    createdAt:serverTimestamp()
  });
  await updateDoc(userRef,{balance:us.data().balance-amt});
};

/* ADMIN */
let adminUnlocked=false;
window.adminLogin=()=>{
  if(adminUnlocked) return;
  if(adminPass.value==="PAPERHOUSE2026"){
    adminUnlocked=true;
    adminPanel.classList.remove("hidden");
  } else alert("Wrong password");
};

/* TIME */
setInterval(()=>time.innerText=new Date().toLocaleString(),1000);
