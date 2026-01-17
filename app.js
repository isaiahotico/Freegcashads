/* ================= TELEGRAM ================= */
let tgUser = null;
if (window.Telegram && Telegram.WebApp) {
  Telegram.WebApp.ready();
  tgUser = Telegram.WebApp.initDataUnsafe.user;
}

const uid = tgUser ? String(tgUser.id) : "guest";
const username = tgUser ? ("@" + (tgUser.username || tgUser.first_name)) : "Guest";

document.getElementById("userBar").innerText = "👤 " + username;

/* ================= FIREBASE ================= */
firebase.initializeApp({
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads"
});

const db = firebase.database();
const userRef = db.ref("users/" + uid);

/* ================= USER INIT ================= */
userRef.once("value").then(s=>{
  if(!s.exists()) userRef.set({username:username,balance:0});
});

userRef.on("value",s=>{
  if(s.exists())
    document.getElementById("balanceBar").innerText =
      "💰 Balance: ₱" + s.val().balance.toFixed(2);
});

/* ================= NAVIGATION ================= */
function openPage(p){
  document.querySelectorAll("[id^='page-']").forEach(e=>e.classList.add("hidden"));
  document.getElementById("page-"+p).classList.remove("hidden");
  renderPage(p);
}
window.openPage=openPage;

/* ================= REWARD ================= */
function reward(amount,key,cd){
  const cdRef=db.ref("cooldowns/"+uid+"/"+key);
  cdRef.once("value").then(s=>{
    if(s.exists() && Date.now()<s.val()) return alert("⏳ Cooldown active");

    userRef.transaction(u=>{
      if(u){u.balance+=amount}
      return u;
    });

    cdRef.set(Date.now()+cd);
    alert("🎉 Congratulations 🎉 you earned ₱"+amount.toFixed(2));
  });
}

/* ================= ADS ================= */
function playAd(zone,amount,key,cd){
  try{
    window["show_"+zone]();
    setTimeout(()=>reward(amount,key,cd),5000);
  }catch(e){ alert("Ad not ready"); }
}
window.playAd=playAd;

/* ================= RENDER ================= */
function renderPage(p){

if(p==="ads"){
page_ads.innerHTML=`
<button onclick="playAd('10276123',0.02,'a1',300000)">🤑🍍 Task #1 🍍🤑</button>
<button onclick="playAd('10337795',0.02,'a2',300000)">🤑🍍 Task #2 🍍🤑</button>
<button onclick="playAd('10337853',0.02,'a3',300000)">🤑🍍 Task #3 🍍🤑</button>`;
}

if(p==="signin"){
page_signin.innerHTML=`
<button onclick="playAd('10276123',0.025,'s1',10800000)">🍍 Task #1 🍍</button>
<button onclick="playAd('10337795',0.025,'s2',10800000)">🍍 Task #2 🍍</button>
<button onclick="playAd('10337853',0.025,'s3',10800000)">🍍 Task #3 🍍</button>`;
}

if(p==="gift"){
page_gift.innerHTML=`
<button onclick="playAd('10276123',0.02,'g1',1200000)">🍍 Gift #1 🍍</button>
<button onclick="playAd('10337795',0.02,'g2',1200000)">🍍 Gift #2 🍍</button>
<button onclick="playAd('10337853',0.02,'g3',1200000)">🍍 Gift #3 🍍</button>`;
}

if(p==="withdraw"){
page_withdraw.innerHTML=`
<input id="gcash" placeholder="GCash Number">
<button onclick="withdraw()">Withdraw All</button>
<div id="userHistory"></div>
<div id="userPager"></div>`;
loadUserWithdrawals(1);
}
}

/* ================= WITHDRAW ================= */
function withdraw(){
userRef.once("value").then(s=>{
if(s.val().balance<=0) return alert("No balance");

const id=db.ref("withdrawals").push().key;
const data={uid,username,amount:s.val().balance,status:"pending",time:Date.now()};

db.ref("withdrawals/"+id).set(data);
db.ref("userWithdrawals/"+uid+"/"+id).set(data);
userRef.update({balance:0});
});
}
window.withdraw=withdraw;

/* ================= USER HISTORY ================= */
function loadUserWithdrawals(page){
const size=10;
db.ref("userWithdrawals/"+uid).on("value",s=>{
let arr=[];
s.forEach(c=>arr.push(c.val()));
arr.sort((a,b)=>b.time-a.time);

const pages=Math.max(1,Math.ceil(arr.length/size));
const slice=arr.slice((page-1)*size,page*size);

userHistory.innerHTML=slice.map(w=>`
<div class="card">₱${w.amount} - ${w.status}</div>`).join("");

userPager.innerHTML=`
<button ${page<=1?"disabled":""} onclick="loadUserWithdrawals(${page-1})">Prev</button>
${page}/${pages}
<button ${page>=pages?"disabled":""} onclick="loadUserWithdrawals(${page+1})">Next</button>`;
});
}
window.loadUserWithdrawals=loadUserWithdrawals;

/* ================= OWNER ================= */
const OWNER_PASS="propetas6";
let ownerOK=false;

function ownerLogin(){
if(ownerPass.value!==OWNER_PASS) return alert("Wrong password");
ownerOK=true;
ownerLoginBox.classList.add("hidden");
ownerPanel.classList.remove("hidden");
loadAllWithdrawals(1);
}
window.ownerLogin=ownerLogin;

function loadAllWithdrawals(page){
if(!ownerOK) return;
const size=10;

db.ref("withdrawals").on("value",s=>{
let arr=[],total=0;
s.forEach(c=>{
arr.push({id:c.key,...c.val()});
if(c.val().status==="paid") total+=c.val().amount;
});

arr.sort((a,b)=>b.time-a.time);
const pages=Math.max(1,Math.ceil(arr.length/size));
const slice=arr.slice((page-1)*size,page*size);

ownerTotal.innerText="💰 Total Paid: ₱"+total.toFixed(2);

ownerList.innerHTML=slice.map(w=>`
<div class="card">
${w.username}<br>₱${w.amount}<br>${w.status}<br>
<button onclick="setWithdraw('${w.id}','paid')">Approve</button>
<button onclick="setWithdraw('${w.id}','denied')">Deny</button>
</div>`).join("");

ownerPager.innerHTML=`
<button ${page<=1?"disabled":""} onclick="loadAllWithdrawals(${page-1})">Prev</button>
${page}/${pages}
<button ${page>=pages?"disabled":""} onclick="loadAllWithdrawals(${page+1})">Next</button>`;
});
}
window.loadAllWithdrawals=loadAllWithdrawals;

function setWithdraw(id,status){
db.ref("withdrawals/"+id).once("value").then(s=>{
const d=s.val(); d.status=status;
db.ref("withdrawals/"+id).set(d);
db.ref("userWithdrawals/"+d.uid+"/"+id).set(d);
});
}
window.setWithdraw=setWithdraw;
