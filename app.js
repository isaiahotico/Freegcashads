import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, push, update, query, orderByChild, limitToFirst, startAt } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===== FIREBASE CONFIG ===== */
const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
await signInAnonymously(auth);

const uid = auth.currentUser.uid;

/* ===== TELEGRAM USER ===== */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
if(user) document.getElementById("userBar").innerText = `👤 ${user.first_name}`;

/* ===== ELEMENTS ===== */
const watchBtn = document.getElementById("watchAdBtn");
const timerEl = document.getElementById("timer");
const balanceBar = document.getElementById("balanceBar");
const ownerPass = document.getElementById("ownerPass");
const ownerPanel = document.getElementById("ownerPanel");
const ownerTable = document.getElementById("ownerTable");

/* ===== NAVIGATION ===== */
function openPage(page){
  ["ads","history","withdraw","owner"].forEach(p=>{
    document.getElementById(`page-${p}`).classList.add("hidden");
  });
  document.getElementById(`page-${page}`).classList.remove("hidden");
}

/* ===== USER INIT ===== */
async function initUser(referrer=null){
  const userRef = ref(db, `users/${uid}`);
  const snapshot = await get(userRef);
  if(!snapshot.exists()){
    await set(userRef,{
      balance:0,
      lastAd:0,
      referrer:referrer||null
    });
  }
}
initUser(); // auto init

/* ===== MULTIPLE AD ZONES ===== */
const adZones = [()=>show_10276123(), ()=>show_10337795(), ()=>show_10337853()];
function showRandomAd(){
  adZones[Math.floor(Math.random()*adZones.length)]();
}

/* ===== REWARD LOGIC ===== */
const REWARD = 0.02;
const COOLDOWN = 12*60*60*1000;
let adRunning = false;

watchBtn.onclick = async () => {
  if(adRunning) return;
  adRunning=true;
  watchBtn.disabled=true;

  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const now = Date.now();
  if(now - (snap.val().lastAd||0) < COOLDOWN){
    alert("⏱ Come back later!");
    adRunning=false;
    watchBtn.disabled=false;
    return;
  }

  let t=5;
  timerEl.innerText=`⏳ Watching ad ${t}s`;
  showRandomAd();

  const interval = setInterval(async ()=>{
    t--;
    timerEl.innerText=`⏳ Watching ad ${t}s`;
    if(t<=0){
      clearInterval(interval);
      const newBalance = (snap.val().balance||0)+REWARD;
      await update(userRef,{balance:newBalance,lastAd:now});
      await rewardReferral(REWARD);
      await push(ref(db, `history/${uid}`), {type:'ad', amount:REWARD, timestamp:now});
      balanceBar.innerText=`💰 Balance: ₱${newBalance.toFixed(2)}`;
      timerEl.innerText=`✅ You earned ₱${REWARD}`;
      adRunning=false;
      watchBtn.disabled=false;
    }
  },1000);
};

/* ===== REFERRAL ===== */
async function rewardReferral(amount){
  const snap = await get(ref(db, `users/${uid}`));
  const referrerUid = snap.val().referrer;
  if(referrerUid){
    const refSnap = await get(ref(db, `users/${referrerUid}/balance`));
    const currentBal = refSnap.val()||0;
    await set(ref(db, `users/${referrerUid}/balance`), currentBal + amount*0.1);
  }
}

/* ===== WITHDRAW ===== */
async function requestWithdrawUI(){
  const amt = parseFloat(document.getElementById("withdrawAmount").value);
  const method = document.getElementById("withdrawMethod").value;
  const account = document.getElementById("withdrawAccount").value;
  if(!amt || !method || !account) return alert("Fill all fields");

  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  if(amt > (snap.val().balance||0)) return alert("Insufficient balance");

  await update(userRef,{balance:snap.val().balance-amt});
  await push(ref(db, 'withdrawals'),{uid,amount:amt,method,account,status:'pending',timestamp:Date.now()});
  await push(ref(db, `history/${uid}`),{type:'withdraw',amount:amt,timestamp:Date.now()});
  alert("✅ Withdrawal requested");
}

/* ===== HISTORY ===== */
async function loadHistory(){
  const snap = await get(ref(db, `history/${uid}`));
  const data = snap.val()||{};
  let html="<table><tr><th>Type</th><th>Amount</th></tr>";
  Object.values(data).forEach(h=>{
    html+=`<tr><td>${h.type}</td><td>₱${h.amount}</td></tr>`;
  });
  html+="</table>";
  document.getElementById("page-history").innerHTML=html;
}
loadHistory();

/* ===== OWNER DASHBOARD ===== */
const OWNER_PASS="ADMIN123";
let page=0;
const PAGE_SIZE=10;

ownerPass.addEventListener('keypress',(e)=>{
  if(e.key==='Enter') ownerLogin();
});

async function ownerLogin(){
  if(ownerPass.value!==OWNER_PASS) return alert("Wrong password");
  ownerPanel.classList.remove("hidden");
  loadWithdrawals();
}

async function loadWithdrawals(){
  const snap = await get(ref(db, 'withdrawals'));
  const data = snap.val()||{};
  const keys = Object.keys(data).sort((a,b)=>data[b].timestamp - data[a].timestamp);
  const start=page*PAGE_SIZE;
  const pageData = keys.slice(start,start+PAGE_SIZE);
  let html="<table><tr><th>UID</th><th>₱</th><th>Status</th></tr>";
  pageData.forEach(k=>{
    const w=data[k];
    html+=`<tr><td>${w.uid}</td><td>${w.amount}</td><td>${w.status}</td></tr>`;
  });
  html+="</table>";
  ownerTable.innerHTML=html;
}

/* ===== OWNER PAGINATION ===== */
document.getElementById('nextPage').onclick=()=>{
  page++;
  loadWithdrawals();
}
document.getElementById('prevPage').onclick=()=>{
  if(page>0) page--;
  loadWithdrawals();
}
