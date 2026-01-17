Telegram.WebApp?.ready();

/* USER */
const tgUser = Telegram.WebApp?.initDataUnsafe?.user;
const uid = tgUser ? tgUser.id : "guest";
const username = tgUser ? "@"+(tgUser.username||tgUser.first_name) : "Guest";
userBar.innerText = "👤 "+username;

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
  balanceBar.innerText="💰 ₱"+(s.val()?.balance||0).toFixed(2);
});

/* NAV */
function openPage(p){
  document.querySelectorAll("[id^='page-']").forEach(d=>d.classList.add("hidden"));
  document.getElementById("page-"+p).classList.remove("hidden");
  if(p==="withdraw") loadUser();
}
window.openPage=openPage;

/* ADS */
function playAd(zone,amt){
  window["show_"+zone]().then(()=>reward(amt));
}
function playPopup(zone,amt){
  window["show_"+zone]("pop").then(()=>reward(amt));
}
function reward(a){
  userRef.transaction(u=>{u.balance+=a;return u});
  alert("🎉 Congratulations 🎉 You earned ₱"+a);
}

/* WITHDRAW */
function withdraw(){
  userRef.once("value").then(s=>{
    let bal=s.val().balance;
    if(bal<=0) return alert("No balance");
    const id=db.ref("withdrawals").push().key;
    const data={uid,username,amount:bal,status:"pending",time:Date.now()};
    db.ref("withdrawals/"+id).set(data);
    db.ref("userWithdrawals/"+uid+"/"+id).set(data);
    userRef.update({balance:0});
  });
}
window.withdraw=withdraw;

/* USER PAGINATION */
let uPage=0,uData=[];
function loadUser(){
  db.ref("userWithdrawals/"+uid).once("value").then(s=>{
    uData=[];
    s.forEach(c=>uData.unshift(c.val()));
    renderUser();
  });
}
function renderUser(){
  let list=uData.slice(uPage*10,uPage*10+10);
  userTable.innerHTML=list.map(w=>`
    <tr>
      <td>₱${w.amount}</td>
      <td>${w.status}</td>
      <td>${new Date(w.time).toLocaleDateString()}</td>
    </tr>`).join("")||"<tr><td colspan=3>No data</td></tr>";
  userPage.innerText=`Page ${uPage+1}`;
}
function userNext(){if((uPage+1)*10<uData.length){uPage++;renderUser();}}
function userPrev(){if(uPage>0){uPage--;renderUser();}}
window.userNext=userNext;window.userPrev=userPrev;

/* OWNER */
const PASS="propetas6";
let oPage=0,oData=[];
function ownerLogin(){
  if(ownerPass.value!==PASS) return alert("Wrong password");
  ownerPanel.classList.remove("hidden");
  loadOwner();
}
window.ownerLogin=ownerLogin;

function loadOwner(){
  db.ref("withdrawals").once("value").then(s=>{
    oData=[];
    s.forEach(c=>oData.unshift({id:c.key,...c.val()}));
    renderOwner();
  });
}
function renderOwner(){
  let list=oData.slice(oPage*10,oPage*10+10);
  ownerTable.innerHTML=list.map(w=>`
    <tr>
      <td>${w.username}</td>
      <td>₱${w.amount}</td>
      <td>${w.status}</td>
      <td>
        <button onclick="setW('${w.id}','paid')">✔</button>
        <button onclick="setW('${w.id}','denied')">✖</button>
      </td>
    </tr>`).join("");
  ownerPage.innerText=`Page ${oPage+1}`;
}
function ownerNext(){if((oPage+1)*10<oData.length){oPage++;renderOwner();}}
function ownerPrev(){if(oPage>0){oPage--;renderOwner();}}
window.ownerNext=ownerNext;window.ownerPrev=ownerPrev;

function setW(id,st){
  db.ref("withdrawals/"+id).once("value").then(s=>{
    let d=s.val(); d.status=st;
    db.ref("withdrawals/"+id).set(d);
    db.ref("userWithdrawals/"+d.uid+"/"+id).set(d);
    loadOwner();
  });
}
window.setW=setW;
