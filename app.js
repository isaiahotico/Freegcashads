import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* TELEGRAM */
const tg = Telegram.WebApp;
tg.ready(); tg.expand();

/* USER */
const user = tg.initDataUnsafe.user;
const uid = String(user.id);
const username = "@" + (user.username || user.first_name);
userBar.innerText = "👤 " + username;

/* FIREBASE */
const app = initializeApp({
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = getDatabase(app);
const userRef = ref(db, "users/" + uid);

/* INIT USER */
get(userRef).then(s=>{
  if(!s.exists()) set(userRef,{username,balance:0});
});

/* BALANCE LIVE */
onValue(userRef,s=>{
  balanceBar.innerText="💰 ₱"+Number(s.val()?.balance||0).toFixed(2);
});

/* PRELOAD PAGES */
const pages={
ads:`<h3>ADS</h3>
<button onclick="playAd('10276123',0.02,'a1',300000)">Task 1</button>
<button onclick="playAd('10337795',0.02,'a2',300000)">Task 2</button>
<button onclick="playAd('10337853',0.02,'a3',300000)">Task 3</button>`,
signin:`<h3>SIGN IN</h3>
<button onclick="playAd('10276123',0.025,'s1',10800000)">Task 1</button>
<button onclick="playAd('10337795',0.025,'s2',10800000)">Task 2</button>
<button onclick="playAd('10337853',0.025,'s3',10800000)">Task 3</button>`,
gift:`<h3>GIFTS</h3>
<button onclick="playAd('10276123',0.02,'g1',1200000)">Gift 1</button>
<button onclick="playAd('10337795',0.02,'g2',1200000)">Gift 2</button>
<button onclick="playAd('10337853',0.02,'g3',1200000)">Gift 3</button>`
};
Object.keys(pages).forEach(p=>document.getElementById("page-"+p).innerHTML=pages[p]);

/* NAV */
window.openPage=p=>{
  document.querySelectorAll(".page").forEach(x=>x.style.display="none");
  document.getElementById("page-"+p).style.display="block";
  if(p==="withdraw") loadUserWithdrawals(1);
};

/* ADS */
window.playAd=(z,a,k,c)=>{
  try{window["show_"+z]();}catch{}
  setTimeout(()=>reward(a,k,c),5000);
};

async function reward(a,k,c){
  const cd=ref(db,"cooldowns/"+uid+"/"+k);
  const now=Date.now();
  const s=await get(cd);
  if(s.exists() && now<s.val()) return alert("Cooldown active");

  await runTransaction(userRef,u=>{
    if(!u)u={username,balance:0};
    u.balance+=a; return u;
  });
  await set(cd,now+c);
}

/* WITHDRAW REQUEST (MIN ₱0.05) */
requestWithdrawal.onclick=async()=>{
  const name=fullName.value.trim();
  const gcash=gcashNumber.value.trim();
  const amount=parseFloat(withdrawAmount.value);

  if(!name||!gcash||!amount) return alert("Fill all fields");
  if(amount<0.05) return alert("Minimum withdrawal is ₱0.05");

  const s=await get(userRef);
  if(amount>Number(s.val().balance)) return alert("Insufficient balance");

  const id=push(ref(db,"withdrawals")).key;
  const data={uid,username,name,gcash,amount,status:"pending",time:Date.now()};

  await set(ref(db,"withdrawals/"+id),data);
  await set(ref(db,"userWithdrawals/"+uid+"/"+id),data);
  await update(userRef,{balance:s.val().balance-amount});
  alert("Withdrawal submitted");
};

/* USER HISTORY (10/page) */
window.loadUserWithdrawals=(p=1)=>{
  const size=10;
  onValue(ref(db,"userWithdrawals/"+uid),s=>{
    let a=[]; s.forEach(c=>a.push(c.val()));
    a.sort((x,y)=>y.time-x.time);
    const pages=Math.max(1,Math.ceil(a.length/size));
    const slice=a.slice((p-1)*size,p*size);

    withdrawTable.innerHTML=`
    <table><tr><th>Name</th><th>GCash</th><th>Amount</th><th>Status</th><th>Date</th></tr>
    ${slice.map(w=>`
    <tr><td>${w.name}</td><td>${w.gcash}</td>
    <td>₱${w.amount}</td><td>${w.status}</td>
    <td>${new Date(w.time).toLocaleString()}</td></tr>`).join("")}</table>`;
    withdrawPager.innerHTML=`<button ${p<=1?"disabled":""} onclick="loadUserWithdrawals(${p-1})">Prev</button>
    ${p}/${pages}
    <button ${p>=pages?"disabled":""} onclick="loadUserWithdrawals(${p+1})">Next</button>`;
  });
};

/* OWNER */
const OWNER_PASSWORD="propetas6";
window.ownerLogin=()=>{
  if(ownerPass.value!==OWNER_PASSWORD) return alert("Wrong password");
  ownerPanel.style.display="block";
  loadAllWithdrawals(1);
};

window.loadAllWithdrawals=(p=1)=>{
  const size=10;
  onValue(ref(db,"withdrawals"),s=>{
    let a=[],total=0;
    s.forEach(c=>{a.push({id:c.key,...c.val()}); if(c.val().status==="paid") total+=c.val().amount;});
    a.sort((x,y)=>y.time-x.time);
    const pages=Math.max(1,Math.ceil(a.length/size));
    const slice=a.slice((p-1)*size,p*size);

    ownerTotal.innerText="Total Paid ₱"+total.toFixed(2);
    ownerTable.innerHTML=`<table>
    <tr><th>User</th><th>Name</th><th>GCash</th><th>Amount</th><th>Status</th><th>Action</th></tr>
    ${slice.map(w=>`
    <tr><td>${w.username}</td><td>${w.name}</td><td>${w.gcash}</td>
    <td>₱${w.amount}</td><td>${w.status}</td>
    <td><button onclick="setWithdraw('${w.id}','paid')">Approve</button>
    <button onclick="setWithdraw('${w.id}','denied')">Deny</button></td></tr>`).join("")}
    </table>`;
    ownerPager.innerHTML=`<button ${p<=1?"disabled":""} onclick="loadAllWithdrawals(${p-1})">Prev</button>
    ${p}/${pages}
    <button ${p>=pages?"disabled":""} onclick="loadAllWithdrawals(${p+1})">Next</button>`;
  });
};

window.setWithdraw=async(id,status)=>{
  const s=await get(ref(db,"withdrawals/"+id));
  const d=s.val(); d.status=status;
  await update(ref(db,"withdrawals/"+id),d);
  await update(ref(db,"userWithdrawals/"+d.uid+"/"+id),d);
};
