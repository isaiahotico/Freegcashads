import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ================= TELEGRAM ================= */
const tg = window.Telegram.WebApp;
tg.ready();
const user = tg.initDataUnsafe?.user;
const uid = String(user.id);
const username = "@" + (user.username || user.first_name);
userBar.innerText = "👤 " + username;

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.appspot.com",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const userRef = ref(db, "users/" + uid);

/* ================= USER INIT ================= */
get(userRef).then(s=>{
  if(!s.exists()) set(userRef,{username,balance:0});
});

onValue(userRef,s=>{
  if(s.exists()) balanceBar.innerText="💰 Balance: ₱"+s.val().balance.toFixed(2);
});

/* ================= NAV ================= */
window.openPage = p => {
  document.querySelectorAll("[id^='page-']").forEach(e=>e.classList.add("hidden"));
  document.getElementById("page-"+p).classList.remove("hidden");
  renderPage(p);
};

/* ================= REWARD ================= */
async function reward(amount,key,cd){
  const cRef=ref(db,"cooldowns/"+uid+"/"+key);
  const now=Date.now();
  const s=await get(cRef);
  if(s.exists() && now<s.val()) return alert("⏳ Cooldown active");

  await runTransaction(userRef,u=>{u.balance+=amount;return u});
  await set(cRef,now+cd);
  alert("🎉 Congratulations 🎉 You earned ₱"+amount);
}

/* ================= ADS ================= */
window.playAd=(zone,amount,key,cd)=>{
  window["show_"+zone]();
  setTimeout(()=>reward(amount,key,cd),5000);
};

/* ================= RENDER ================= */
function renderPage(p){

if(p==="ads"){
page_ads.innerHTML=`
<h3>ADS AREA</h3>
<button onclick="playAd('10276123',0.02,'a1',300000)">Task #1</button>
<button onclick="playAd('10337795',0.02,'a2',300000)">Task #2</button>
<button onclick="playAd('10337853',0.02,'a3',300000)">Task #3</button>`;
}

if(p==="signin"){
page_signin.innerHTML=`
<h3>SIGN IN</h3>
<button onclick="playAd('10276123',0.025,'s1',10800000)">Task #1</button>
<button onclick="playAd('10337795',0.025,'s2',10800000)">Task #2</button>
<button onclick="playAd('10337853',0.025,'s3',10800000)">Task #3</button>`;
}

if(p==="gift"){
page_gift.innerHTML=`
<h3>GIFTS</h3>
<button onclick="playAd('10276123',0.02,'g1',1200000)">Gift #1</button>
<button onclick="playAd('10337795',0.02,'g2',1200000)">Gift #2</button>
<button onclick="playAd('10337853',0.02,'g3',1200000)">Gift #3</button>`;
}

if(p==="withdraw"){
page_withdraw.innerHTML=`
<h3>Withdraw</h3>
<input id="gcash" placeholder="GCash Number">
<button onclick="withdraw()">Withdraw All</button>
<div id="userHistory"></div>
<div id="userPager"></div>`;
loadUserWithdrawals(1);
}
}

/* ================= WITHDRAW ================= */
window.withdraw=async()=>{
const s=await get(userRef);
if(s.val().balance<=0) return alert("No balance");
const id=push(ref(db,"withdrawals")).key;
const data={uid,username,amount:s.val().balance,status:"pending",time:Date.now()};
set(ref(db,"withdrawals/"+id),data);
set(ref(db,"userWithdrawals/"+uid+"/"+id),data);
update(userRef,{balance:0});
};

/* ================= USER HISTORY ================= */
window.loadUserWithdrawals=page=>{
const size=10;
onValue(ref(db,"userWithdrawals/"+uid),s=>{
let arr=[];
s.forEach(c=>arr.push(c.val()));
arr.sort((a,b)=>b.time-a.time);
const pages=Math.max(1,Math.ceil(arr.length/size));
const slice=arr.slice((page-1)*size,page*size);
userHistory.innerHTML=slice.map(w=>`<div class="card">₱${w.amount} - ${w.status}</div>`).join("")||"No records";
userPager.innerHTML=`<button ${page<=1?"disabled":""} onclick="loadUserWithdrawals(${page-1})">Prev</button> ${page}/${pages} <button ${page>=pages?"disabled":""} onclick="loadUserWithdrawals(${page+1})">Next</button>`;
});
};

/* ================= OWNER ================= */
const OWNER_PASSWORD="propetas6";
let ownerOK=false;

window.ownerLogin=()=>{
if(ownerPass.value!==OWNER_PASSWORD) return alert("Wrong password");
ownerOK=true;
ownerLogin.classList.add("hidden");
ownerPanel.classList.remove("hidden");
loadAllWithdrawals(1);
};

window.loadAllWithdrawals=page=>{
if(!ownerOK) return;
const size=10;
onValue(ref(db,"withdrawals"),s=>{
let arr=[],total=0;
s.forEach(c=>{arr.push({id:c.key,...c.val()});if(c.val().status==="paid")total+=c.val().amount});
arr.sort((a,b)=>b.time-a.time);
const pages=Math.max(1,Math.ceil(arr.length/size));
const slice=arr.slice((page-1)*size,page*size);
ownerTotal.innerText="Total Paid: ₱"+total.toFixed(2);
ownerList.innerHTML=slice.map(w=>`
<div class="card">
${w.username}<br>₱${w.amount}<br>${w.status}<br>
<button onclick="setWithdraw('${w.id}','paid')">Approve</button>
<button onclick="setWithdraw('${w.id}','denied')">Deny</button>
</div>`).join("");
ownerPager.innerHTML=`<button ${page<=1?"disabled":""} onclick="loadAllWithdrawals(${page-1})">Prev</button> ${page}/${pages} <button ${page>=pages?"disabled":""} onclick="loadAllWithdrawals(${page+1})">Next</button>`;
});
};

window.setWithdraw=async(id,status)=>{
const r=ref(db,"withdrawals/"+id);
const s=await get(r);
if(!s.exists())return;
const d=s.val();d.status=status;
update(r,d);
update(ref(db,"userWithdrawals/"+d.uid+"/"+id),d);
};
