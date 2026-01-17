/* TELEGRAM */
Telegram.WebApp?.ready();
const tgUser = Telegram.WebApp?.initDataUnsafe?.user;
const uid = tgUser ? tgUser.id : "guest";
const username = tgUser ? "@"+(tgUser.username||tgUser.first_name) : "Guest";
userBar.innerText="👤 "+username;

/* FIREBASE */
firebase.initializeApp({
  apiKey:"AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  databaseURL:"https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db=firebase.database();
const userRef=db.ref("users/"+uid);

userRef.once("value").then(s=>{
  if(!s.exists()) userRef.set({username,balance:0});
});
userRef.on("value",s=>{
  balanceBar.innerText="💰 Balance: ₱"+(s.val()?.balance||0).toFixed(2);
});

/* NAV */
function openPage(p){
  document.querySelectorAll("[id^='page-']").forEach(e=>e.classList.add("hidden"));
  document.getElementById("page-"+p).classList.remove("hidden");

  if(p==="ads") page_ads.innerHTML=`<button onclick="playAd('10276123',0.02)">Ad</button>`;
  if(p==="signin") page_signin.innerHTML=`<button onclick="playAd('10337795',0.025)">Sign</button>`;
  if(p==="gift") page_gift.innerHTML=`<button onclick="playAd('10337853',0.02)">Gift</button>`;
  if(p==="withdraw") loadUserWithdrawals();
}
window.openPage=openPage;

/* ADS */
function playAd(zone,amt){
  window["show_"+zone]();
  setTimeout(()=>reward(amt),5000);
}
function reward(a){
  userRef.transaction(u=>{u.balance+=a;return u});
  alert("Earned ₱"+a);
}

/* WITHDRAW */
function withdraw(){
  userRef.once("value").then(s=>{
    if(s.val().balance<=0) return alert("No balance");
    const id=db.ref("withdrawals").push().key;
    const d={uid,username,amount:s.val().balance,status:"pending",time:Date.now()};
    db.ref("withdrawals/"+id).set(d);
    db.ref("userWithdrawals/"+uid+"/"+id).set(d);
    userRef.update({balance:0});
  });
}
window.withdraw=withdraw;

/* USER PAGINATION */
let userPageIndex=0,userData=[];
function loadUserWithdrawals(){
  db.ref("userWithdrawals/"+uid).once("value").then(s=>{
    userData=[];
    s.forEach(c=>userData.unshift(c.val()));
    renderUser();
  });
}
function renderUser(){
  let start=userPageIndex*10;
  let page=userData.slice(start,start+10);
  userHistory.innerHTML=page.map(w=>`<div class="card">₱${w.amount} - ${w.status}</div>`).join("")||"No records";
  userPage.innerText=`Page ${userPageIndex+1}`;
}
function userNext(){if((userPageIndex+1)*10<userData.length){userPageIndex++;renderUser();}}
function userPrev(){if(userPageIndex>0){userPageIndex--;renderUser();}}
window.userNext=userNext;window.userPrev=userPrev;

/* OWNER */
const OWNER_PASS="propetas6";
let ownerPageIndex=0,ownerData=[];
function ownerLogin(){
  if(ownerPass.value!==OWNER_PASS) return alert("Wrong");
  ownerPanel.classList.remove("hidden");
  loadOwner();
}
window.ownerLogin=ownerLogin;

function loadOwner(){
  db.ref("withdrawals").once("value").then(s=>{
    ownerData=[];
    let total=0;
    s.forEach(c=>{
      ownerData.unshift({id:c.key,...c.val()});
      if(c.val().status==="paid") total+=c.val().amount;
    });
    ownerTotal.innerText="Total Paid ₱"+total.toFixed(2);
    renderOwner();
  });
}
function renderOwner(){
  let start=ownerPageIndex*10;
  let page=ownerData.slice(start,start+10);
  ownerList.innerHTML=page.map(w=>`
  <div class="card">
    ${w.username}<br>₱${w.amount}<br>${w.status}
    <button onclick="setWithdraw('${w.id}','paid')">Approve</button>
    <button onclick="setWithdraw('${w.id}','denied')">Deny</button>
  </div>`).join("");
  ownerPage.innerText=`Page ${ownerPageIndex+1}`;
}
function ownerNext(){if((ownerPageIndex+1)*10<ownerData.length){ownerPageIndex++;renderOwner();}}
function ownerPrev(){if(ownerPageIndex>0){ownerPageIndex--;renderOwner();}}
window.ownerNext=ownerNext;window.ownerPrev=ownerPrev;

function setWithdraw(id,status){
  db.ref("withdrawals/"+id).once("value").then(s=>{
    let d=s.val();d.status=status;
    db.ref("withdrawals/"+id).set(d);
    db.ref("userWithdrawals/"+d.uid+"/"+id).set(d);
    loadOwner();
  });
}
window.setWithdraw=setWithdraw;
