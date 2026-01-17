import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* CLICK GOLD EFFECT */
document.addEventListener("click",()=>{
  document.body.classList.add("active");
  clearTimeout(window.gold);
  window.gold=setTimeout(()=>document.body.classList.remove("active"),1000);
});

/* TELEGRAM */
const tg = window.Telegram.WebApp;
tg.ready();
const user = tg.initDataUnsafe.user;
const uid = String(user.id);
const username = "@"+(user.username||user.first_name);
userBar.innerText = "👤 "+username;

/* FIREBASE */
const app = initializeApp({
  apiKey:"AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  databaseURL:"https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"freegcash-ads"
});
const db = getDatabase(app);
const userRef = ref(db,"users/"+uid);

/* PAGE CACHE */
const pages={
  ads:page_ads,
  signin:page_signin,
  gift:page_gift,
  withdraw:page_withdraw,
  history:page_history,
  owner:page_owner
};

/* USER INIT */
get(userRef).then(s=>{
  if(!s.exists()) set(userRef,{username,balance:0});
});
onValue(userRef,s=>{
  if(s.exists()) balanceBar.innerText="💰 Balance ₱"+s.val().balance.toFixed(2);
});

/* NAV */
window.openPage=function(p){
  Object.values(pages).forEach(e=>e.classList.add("hidden"));
  pages[p].classList.remove("hidden");
  render(p);
};

/* ADS */
window.playAd=function(zone,amt,key,cd){
  window["show_"+zone]();
  let t=5;
  document.getElementById("timer-"+key).innerText="⏳ "+t;
  const i=setInterval(()=>{
    t--;
    document.getElementById("timer-"+key).innerText="⏳ "+t;
    if(t<=0){clearInterval(i);reward(amt,key,cd);}
  },1000);
};

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
pages.ads.innerHTML=`
<div class="box">
<div class="timer" id="timer-a1"></div>
<button onclick="playAd('10276123',0.02,'a1',300000)">Ad #1</button>
</div>`;
}

if(p==="signin"){
pages.signin.innerHTML=`
<div class="box">
<div class="timer" id="timer-s1"></div>
<button onclick="playAd('10337795',0.025,'s1',10800000)">Sign In Reward</button>
</div>`;
}

if(p==="gift"){
pages.gift.innerHTML=`
<div class="box">
<div class="timer" id="timer-g1"></div>
<button onclick="playAd('10337853',0.02,'g1',1200000)">Gift Reward</button>
</div>`;
}

if(p==="withdraw"){
pages.withdraw.innerHTML=`
<h3>GCash Withdraw</h3>
<input id="wname" placeholder="Full Name">
<input id="wgcash" placeholder="GCash Number">
<button onclick="withdraw()">Withdraw (Min ₱0.05)</button>`;
}

if(p==="history"){
pages.history.innerHTML=`
<h3>Withdrawal History</h3>
<div id="histTable"></div>
<div id="histPager"></div>`;
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
alert("Withdrawal submitted");
};

/* USER HISTORY */
window.loadHistory=function(page){
onValue(ref(db,"userWithdrawals/"+uid),s=>{
let arr=[];
s.forEach(c=>arr.push(c.val()));
arr.sort((a,b)=>b.time-a.time);
const size=10;
const pagesCount=Math.max(1,Math.ceil(arr.length/size));
const slice=arr.slice((page-1)*size,page*size);

histTable.innerHTML=`
<table>
<tr><th>Amount</th><th>Status</th><th>Date</th></tr>
${slice.map(w=>`
<tr>
<td>₱${w.amount}</td>
<td>${w.status}</td>
<td>${new Date(w.time).toLocaleString()}</td>
</tr>`).join("")}
</table>`;

histPager.innerHTML=`
<button ${page<=1?"disabled":""} onclick="loadHistory(${page-1})">Prev</button>
${page}/${pagesCount}
<button ${page>=pagesCount?"disabled":""} onclick="loadHistory(${page+1})">Next</button>`;
});
};

/* OWNER */
const OWNER_PASS="propetas6";
window.ownerLogin=function(){
if(ownerPass.value!==OWNER_PASS) return alert("Wrong password");
ownerPanel.classList.remove("hidden");
loadOwner(1);
};

function loadOwner(page){
onValue(ref(db,"withdrawals"),s=>{
let arr=[],total=0;
s.forEach(c=>{
arr.push({id:c.key,...c.val()});
if(c.val().status==="paid") total+=c.val().amount;
});
arr.sort((a,b)=>b.time-a.time);
const size=10;
const pagesCount=Math.max(1,Math.ceil(arr.length/size));
const slice=arr.slice((page-1)*size,page*size);

ownerTotal.innerText="Total Paid ₱"+total.toFixed(2);

ownerTable.innerHTML=`
<table>
<tr><th>User</th><th>Amount</th><th>Status</th><th>Action</th></tr>
${slice.map(w=>`
<tr>
<td>${w.username}</td>
<td>₱${w.amount}</td>
<td>${w.status}</td>
<td>
<button onclick="setStatus('${w.id}','paid')">Approve</button>
<button onclick="setStatus('${w.id}','denied')">Deny</button>
</td>
</tr>`).join("")}
</table>`;

ownerPager.innerHTML=`
<button ${page<=1?"disabled":""} onclick="loadOwner(${page-1})">Prev</button>
${page}/${pagesCount}
<button ${page>=pagesCount?"disabled":""} onclick="loadOwner(${page+1})">Next</button>`;
});
}

window.setStatus=function(id,status){
update(ref(db,"withdrawals/"+id),{status});
};
