/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser
  ? `@${tgUser.username || tgUser.first_name}`
  : "Guest";

document.getElementById("userBar").innerText = "👤 User: " + username;

/* ================= FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
await signInAnonymously(auth);

/* ================= TIME ================= */
setInterval(()=>{
  document.getElementById("time").innerText=new Date().toLocaleString();
},1000);

/* ================= COLORS ================= */
const colors=["pink","green","blue","red","violet","yellow","yellowgreen","orange","white","cyan","brown"];
document.getElementById("bg").onclick=()=>{
  document.body.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)];
};
document.querySelectorAll("button").forEach(b=>{
  b.onclick=()=>b.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)];
});

/* ================= BALANCE ================= */
let balance=0;
function addBalance(v){
  balance+=v;
  document.getElementById("balance").innerText="💰 ₱"+balance.toFixed(3);
}

/* ================= CHAT ================= */
let lastSend=0;
let currentLevel="";

function openChat(level){
  currentLevel=level;
  document.getElementById("view").innerHTML=`
    <h3>${level.toUpperCase()} CHAT</h3>
    <div id="msgs"></div>
    <textarea id="msg" rows="3"></textarea>
    <button onclick="sendMsg()">SEND</button>
  `;
  loadMessages();
}

function loadMessages(){
  const q=query(
    collection(db,"messages"),
    where("level","==",currentLevel),
    orderBy("createdAt","desc"),
    limit(50)
  );
  onSnapshot(q,s=>{
    msgs.innerHTML="";
    s.forEach(d=>{
      const m=d.data();
      msgs.innerHTML+=`<p><b>${m.username}</b>: ${m.text}</p>`;
    });
  });
}

async function sendMsg(){
  if(Date.now()-lastSend<180000) return alert("Cooldown active");
  const text=msg.value;
  if(!text) return;

  lastSend=Date.now();

  if(currentLevel==="elementary"){
    await show_10276123();
    await show_10337795();
    await show_10337853();
    addBalance(0.015);
  }else{
    await show_10276123();
    await show_10337795();
    await show_10337853();
    addBalance(0.015);
  }

  await addDoc(collection(db,"messages"),{
    username,
    text,
    level:currentLevel,
    createdAt:serverTimestamp()
  });

  msg.value="";
}

/* ================= WITHDRAW ================= */
function openWithdraw(){
  view.innerHTML=`
    <h3>GCash Withdraw</h3>
    <input id="gcash" placeholder="GCash Number">
    <input id="amount" placeholder="Amount">
    <button onclick="withdraw()">REQUEST</button>
  `;
}

async function withdraw(){
  const amt=parseFloat(amount.value);
  if(balance<amt) return alert("Low balance");

  await addDoc(collection(db,"withdrawals"),{
    username,
    gcash:gcash.value,
    amount:amt,
    status:"pending",
    createdAt:serverTimestamp()
  });

  balance-=amt;
  addBalance(0);
  alert("Withdrawal requested");
}
