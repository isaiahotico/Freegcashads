import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* TELEGRAM FAST MODE */
const tg = Telegram.WebApp;
tg.ready();
tg.expand();
document.body.style.touchAction = "manipulation";

/* USER INFO */
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

/* INIT USER BALANCE */
get(userRef).then(s=>{
  if(!s.exists()) set(userRef,{username,balance:0});
  else if(typeof s.val().balance !== "number") update(userRef,{balance:0});
});

/* DISPLAY BALANCE */
onValue(userRef,s=>{
  if(s.exists()){
    const bal = Number(s.val().balance || 0);
    balanceBar.innerText="💰 ₱"+bal.toFixed(2);
  }
});

/* PRELOAD PAGES */
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
  document.getElementById("page-"+p).innerHTML=pages[p];
});

/* OPEN PAGE FAST */
window.openPage = p => {
  requestAnimationFrame(()=>{
    document.querySelectorAll(".page").forEach(e=>e.style.display="none");
    document.getElementById("page-"+p).style.display="block";
    if(p==="withdraw") loadUserWithdrawals(1);
  });
};

/* PLAY AD & REWARD */
window.playAd=(zone,amount,key,cd)=>{
  try{
    const fn=window["show_"+zone];
    if(typeof fn==="function") setTimeout(fn,50);
  }catch(e){}
  setTimeout(()=>reward(amount,key,cd),5000);
};

/* REWARD FUNCTION */
async function reward(amount,key,cd){
  const cRef = ref(db,"cooldowns/"+uid+"/"+key);
  const now = Date.now();
  const s = await get(cRef);
  if(s.exists() && now < s.val()) return alert("⏳ Cooldown active");

  await runTransaction(userRef, u=>{
    if(!u) u={username,balance:0};
    if(!u.balance) u.balance=0;
    u.balance += amount;
    return u;
  });

  await set(cRef,now+cd);
  alert("🎉 You earned ₱"+amount.toFixed(2));
}

/* WITHDRAW BUTTON HANDLER (CLICKABLE) */
document.getElementById("withdrawBtn").addEventListener("click", withdraw);

async function withdraw(){
  const s = await get(userRef);
  const bal = Number(s.val().balance || 0);
  if(bal <= 0) return alert("No balance to withdraw");

  const id = push(ref(db,"withdrawals")).key;
  const data = {uid,username,amount:bal,status:"pending",time:Date.now()};
  await set(ref(db,"withdrawals/"+id),data);
  await set(ref(db,"userWithdrawals/"+uid+"/"+id),data);
  await update(userRef,{balance:0});
  alert("💸 Withdraw request sent: ₱"+bal.toFixed(2));

  loadUserWithdrawals(1); // refresh table after withdraw
}

/* USER WITHDRAWALS TABLE */
window.loadUserWithdrawals = function(page=1){
  const size = 10;
  onValue(ref(db,"userWithdrawals/"+uid), s=>{
    let arr = [];
    s.forEach(c=>arr.push(c.val()));
    arr.sort((a,b)=>b.time-a.time);
    const pages = Math.max(1, Math.ceil(arr.length/size));
    const slice = arr.slice((page-1)*size,page*size);

    withdrawTable.innerHTML = `
      <table>
        <tr><th>Amount</th><th>Status</th><th>Date</th></tr>
        ${slice.map(w=>`
          <tr>
            <td>₱${w.amount}</td>
            <td>${w.status}</td>
            <td>${new Date(w.time).toLocaleString()}</td>
          </tr>
        `).join("")}
      </table>
    `;

    withdrawPager.innerHTML = `
      <button ${page<=1?"disabled":""} onclick="loadUserWithdrawals(${page-1})">Prev</button>
      ${page}/${pages}
      <button ${page>=pages?"disabled":""} onclick="loadUserWithdrawals(${page+1})">Next</button>
    `;
  });
};

/* OWNER DASHBOARD */
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
