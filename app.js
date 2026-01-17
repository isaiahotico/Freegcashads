import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* TELEGRAM FAST MODE */
const tg = Telegram.WebApp;
tg.ready();
tg.expand();
document.body.style.touchAction = "manipulation";

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
onValue(userRef,s=>{
  if(s.exists()) balanceBar.innerText="💰 ₱"+s.val().balance.toFixed(2);
});

/* PRELOAD ALL PAGES ONCE */
const pages = {
  ads: `
    <h3>ADS</h3>
    <button onclick="playAd('10276123',0.02,'a1',300000)">Task 1</button>
    <button onclick="playAd('10337795',0.02,'a2',300000)">Task 2</button>
    <button onclick="playAd('10337853',0.02,'a3',300000)">Task 3</button>
  `,
  signin: `
    <h3>SIGN IN</h3>
    <button onclick="playAd('10276123',0.025,'s1',10800000)">Task 1</button>
    <button onclick="playAd('10337795',0.025,'s2',10800000)">Task 2</button>
    <button onclick="playAd('10337853',0.025,'s3',10800000)">Task 3</button>
  `,
  gift: `
    <h3>GIFTS</h3>
    <button onclick="playAd('10276123',0.02,'g1',1200000)">Gift 1</button>
    <button onclick="playAd('10337795',0.02,'g2',1200000)">Gift 2</button>
    <button onclick="playAd('10337853',0.02,'g3',1200000)">Gift 3</button>
  `
};

Object.keys(pages).forEach(p=>{
  document.getElementById("page-"+p).innerHTML = pages[p];
});

/* FAST PAGE SWITCH */
window.openPage = p => {
  requestAnimationFrame(()=>{
    document.querySelectorAll(".page").forEach(e=>e.style.display="none");
    document.getElementById("page-"+p).style.display="block";
    if(p==="withdraw") loadUserWithdrawals(1);
  });
};

/* SAFE AD PLAY */
window.playAd=(zone,amount,key,cd)=>{
  try{
    const fn=window["show_"+zone];
    if(typeof fn==="function") setTimeout(fn,50);
  }catch(e){}
  setTimeout(()=>reward(amount,key,cd),5000);
};

/* REWARD */
async function reward(a,k,c){
  const r=ref(db,"cooldowns/"+uid+"/"+k);
  const n=Date.now();
  const s=await get(r);
  if(s.exists() && n<s.val()) return alert("Cooldown active");
  await runTransaction(userRef,u=>{u.balance+=a;return u});
  set(r,n+c);
  alert("🎉 Earned ₱"+a);
}

/* WITHDRAW */
window.withdraw=async()=>{
  const s=await get(userRef);
  if(s.val().balance<=0) return alert("No balance");
  const id=push(ref(db,"withdrawals")).key;
  const d={uid,username,amount:s.val().balance,status:"pending",time:Date.now()};
  set(ref(db,"withdrawals/"+id),d);
  set(ref(db,"userWithdrawals/"+uid+"/"+id),d);
  update(userRef,{balance:0});
};

/* USER HISTORY */
window.loadUserWithdrawals=p=>{
  const size=10;
  onValue(ref(db,"userWithdrawals/"+uid),s=>{
    let a=[];
    s.forEach(c=>a.push(c.val()));
    a.sort((x,y)=>y.time-x.time);
    const pages=Math.max(1,Math.ceil(a.length/size));
    const slice=a.slice((p-1)*size,p*size);
    page_withdraw.innerHTML=`
    <h3>Withdraw</h3>
    <button onclick="withdraw()">Withdraw All</button>
    <table>
      <tr><th>Amount</th><th>Status</th><th>Date</th></tr>
      ${slice.map(w=>`
        <tr><td>₱${w.amount}</td><td>${w.status}</td><td>${new Date(w.time).toLocaleString()}</td></tr>
      `).join("")}
    </table>
    <button onclick="loadUserWithdrawals(${p-1})" ${p<=1?"disabled":""}>Prev</button>
    ${p}/${pages}
    <button onclick="loadUserWithdrawals(${p+1})" ${p>=pages?"disabled":""}>Next</button>`;
  });
};

/* OWNER */
const OWNER_PASSWORD="propetas6";
window.ownerLogin=()=>{
  if(ownerPass.value!==OWNER_PASSWORD) return alert("Wrong");
  ownerPanel.style.display="block";
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
    </table>
    <button onclick="loadAllWithdrawals(${p-1})" ${p<=1?"disabled":""}>Prev</button>
    ${p}/${pages}
    <button onclick="loadAllWithdrawals(${p+1})" ${p>=pages?"disabled":""}>Next</button>`;
  });
};

window.setWithdraw=(id,status)=>{
  get(ref(db,"withdrawals/"+id)).then(s=>{
    const d=s.val(); d.status=status;
    update(ref(db,"withdrawals/"+id),d);
    update(ref(db,"userWithdrawals/"+d.uid+"/"+id),d);
  });
};
