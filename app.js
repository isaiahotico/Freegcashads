import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* GOLD CLICK EFFECT */
document.addEventListener("click",()=>{
  document.body.classList.add("active");
  clearTimeout(window.g);
  window.g=setTimeout(()=>document.body.classList.remove("active"),1200);
});

/* TELEGRAM */
const tg=window.Telegram.WebApp;
tg.ready();
const u=tg.initDataUnsafe.user;
const uid=String(u.id);
const username="@"+(u.username||u.first_name);
userBar.innerText="👤 "+username;

/* FIREBASE */
const app=initializeApp({
  apiKey:"AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  databaseURL:"https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"freegcash-ads"
});
const db=getDatabase(app);
const userRef=ref(db,"users/"+uid);

/* USER INIT */
get(userRef).then(s=>{
  if(!s.exists()) set(userRef,{username,balance:0});
});
onValue(userRef,s=>{
  if(s.exists()) balanceBar.innerText="💰 Balance ₱"+s.val().balance.toFixed(2);
});

/* NAV */
window.openPage=p=>{
  document.querySelectorAll("[id^='page-']").forEach(e=>e.classList.add("hidden"));
  document.getElementById("page-"+p).classList.remove("hidden");
  render(p);
};

/* ADS CORE */
function playAd(zone,amt,key,cd){
  window["show_"+zone]();
  let t=5;
  const box=document.getElementById("timer-"+key);
  box.innerText="⏳ "+t;
  const i=setInterval(()=>{
    t--; box.innerText="⏳ "+t;
    if(t<=0){clearInterval(i);reward(amt,key,cd);}
  },1000);
}

async function reward(amt,key,cd){
  const c=ref(db,"cooldowns/"+uid+"/"+key);
  const now=Date.now();
  const s=await get(c);
  if(s.exists() && s.val()>now) return alert("Cooldown active");
  await runTransaction(userRef,u=>{u.balance+=amt;return u});
  set(c,now+cd);
}

/* RENDER */
function render(p){

if(p==="ads"){
page_ads.innerHTML=`
<div class="adBox">
<div class="timer" id="timer-a1"></div>
<button onclick="playAd('10276123',0.02,'a1',300000)">Ad #1</button>
</div>
<div class="adBox">
<div class="timer" id="timer-a2"></div>
<button onclick="playAd('10337795',0.02,'a2',300000)">Ad #2</button>
</div>`;
}

if(p==="signin"){
page_signin.innerHTML=`
<div class="adBox">
<div class="timer" id="timer-s1"></div>
<button onclick="playAd('10276123',0.025,'s1',10800000)">Sign In #1</button>
</div>`;
}

if(p==="gift"){
page_gift.innerHTML=`
<div class="adBox">
<div class="timer" id="timer-g1"></div>
<button onclick="playAd('10337853',0.02,'g1',1200000)">Gift #1</button>
</div>`;
}

if(p==="withdraw"){
page_withdraw.innerHTML=`
<h3>GCash Withdrawal</h3>
<input id="wname" placeholder="Full Name">
<input id="wgcash" placeholder="GCash Number">
<button onclick="withdraw()">Withdraw (Min ₱0.05)</button>`;
}

if(p==="history"){
page_history.innerHTML=`<div id="hist"></div><div id="pager"></div>`;
loadHistory(1);
}
}

/* WITHDRAW */
window.withdraw=async()=>{
const s=await get(userRef);
if(s.val().balance<0.05) return alert("Minimum ₱0.05");
const id=push(ref(db,"withdrawals")).key;
const data={
  uid,username,
  name:wname.value,
  gcash:wgcash.value,
  amount:s.val().balance,
  status:"pending",
  time:Date.now()
};
set(ref(db,"withdrawals/"+id),data);
set(ref(db,"userWithdrawals/"+uid+"/"+id),data);
update(userRef,{balance:0});
alert("Withdrawal sent");
};

/* HISTORY */
window.loadHistory=p=>{
onValue(ref(db,"userWithdrawals/"+uid),s=>{
let a=[]; s.forEach(c=>a.push(c.val()));
a.sort((x,y)=>y.time-x.time);
const size=10,pages=Math.max(1,Math.ceil(a.length/size));
const sl=a.slice((p-1)*size,p*size);
hist.innerHTML=sl.map(w=>`
<div class="card">₱${w.amount}<br>${w.status}</div>`).join("");
pager.innerHTML=`${p}/${pages}`;
});
};

/* OWNER */
const PASS="propetas6";
window.ownerLogin=()=>{
if(ownerPass.value!==PASS)return alert("Wrong");
ownerPanel.classList.remove("hidden");
loadOwner();
};

function loadOwner(){
onValue(ref(db,"withdrawals"),s=>{
let a=[],total=0;
s.forEach(c=>{
a.push({id:c.key,...c.val()});
if(c.val().status==="paid") total+=c.val().amount;
});
ownerTotal.innerText="Total Paid ₱"+total.toFixed(2);
ownerList.innerHTML=a.map(w=>`
<div class="card">
${w.username}<br>₱${w.amount}<br>${w.status}
<button onclick="setW('${w.id}','paid')">Approve</button>
<button onclick="setW('${w.id}','denied')">Deny</button>
</div>`).join("");
});
}

window.setW=(id,status)=>{
update(ref(db,"withdrawals/"+id),{status});
};
