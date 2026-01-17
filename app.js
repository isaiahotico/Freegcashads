import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* TELEGRAM */
const tg = Telegram.WebApp;
tg.ready();
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

/* USER INIT */
get(userRef).then(s=>{
  if(!s.exists()) set(userRef,{username,balance:0});
});
onValue(userRef,s=>{
  if(s.exists()) balanceBar.innerText="💰 ₱"+s.val().balance.toFixed(2);
});

/* NAV */
window.openPage=p=>{
document.querySelectorAll("[id^=page-]").forEach(e=>e.classList.add("hidden"));
document.getElementById("page-"+p).classList.remove("hidden");
renderPage(p);
};

/* REWARD */
async function reward(a,k,c){
const r=ref(db,"cooldowns/"+uid+"/"+k);
const n=Date.now();
const s=await get(r);
if(s.exists() && n<s.val()) return alert("Cooldown active");
await runTransaction(userRef,u=>{u.balance+=a;return u});
set(r,n+c);
alert("You earned ₱"+a);
}

/* ADS */
window.playAd=(z,a,k,c)=>{
window["show_"+z]();
setTimeout(()=>reward(a,k,c),5000);
};

/* RENDER */
function renderPage(p){

if(p==="withdraw"){
page_withdraw.innerHTML=`
<h3>Withdraw</h3>
<button onclick="withdraw()">Withdraw All</button>
<div id="userTable"></div>
<div id="userPager"></div>`;
loadUserWithdrawals(1);
}
}

/* WITHDRAW */
window.withdraw=async()=>{
const s=await get(userRef);
if(s.val().balance<=0) return alert("No balance");
const id=push(ref(db,"withdrawals")).key;
const data={uid,username,amount:s.val().balance,status:"pending",time:Date.now()};
set(ref(db,"withdrawals/"+id),data);
set(ref(db,"userWithdrawals/"+uid+"/"+id),data);
update(userRef,{balance:0});
};

/* USER TABLE */
window.loadUserWithdrawals=p=>{
const size=10;
onValue(ref(db,"userWithdrawals/"+uid),s=>{
let a=[];
s.forEach(c=>a.push(c.val()));
a.sort((x,y)=>y.time-x.time);
const pages=Math.max(1,Math.ceil(a.length/size));
const slice=a.slice((p-1)*size,p*size);

userTable.innerHTML=`
<table>
<tr><th>Amount</th><th>Status</th><th>Date</th></tr>
${slice.map(w=>`
<tr><td>₱${w.amount}</td><td>${w.status}</td><td>${new Date(w.time).toLocaleString()}</td></tr>`).join("")}
</table>`;

userPager.innerHTML=`<button onclick="loadUserWithdrawals(${p-1})" ${p<=1?"disabled":""}>Prev</button> ${p}/${pages} <button onclick="loadUserWithdrawals(${p+1})" ${p>=pages?"disabled":""}>Next</button>`;
});
};

/* OWNER */
const OWNER_PASSWORD="propetas6";
window.ownerLogin=()=>{
if(ownerPass.value!==OWNER_PASSWORD) return alert("Wrong password");
ownerPanel.classList.remove("hidden");
loadAllWithdrawals(1);
};

window.loadAllWithdrawals=p=>{
const size=10;
onValue(ref(db,"withdrawals"),s=>{
let a=[],total=0;
s.forEach(c=>{a.push({id:c.key,...c.val()});if(c.val().status==="paid")total+=c.val().amount});
a.sort((x,y)=>y.time-x.time);
const pages=Math.max(1,Math.ceil(a.length/size));
const slice=a.slice((p-1)*size,p*size);

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
<button onclick="setWithdraw('${w.id}','paid')">Approve</button>
<button onclick="setWithdraw('${w.id}','denied')">Deny</button>
</td>
</tr>`).join("")}
</table>`;

ownerPager.innerHTML=`<button onclick="loadAllWithdrawals(${p-1})" ${p<=1?"disabled":""}>Prev</button> ${p}/${pages} <button onclick="loadAllWithdrawals(${p+1})" ${p>=pages?"disabled":""}>Next</button>`;
});
};

window.setWithdraw=(id,status)=>{
get(ref(db,"withdrawals/"+id)).then(s=>{
const d=s.val(); d.status=status;
update(ref(db,"withdrawals/"+id),d);
update(ref(db,"userWithdrawals/"+d.uid+"/"+id),d);
});
};
