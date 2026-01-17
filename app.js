import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


/* TELEGRAM */
const tg = window.Telegram?.WebApp; tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
if(!tgUser) alert('Telegram login required');


const uid = String(tgUser.id);
const username = '@' + (tgUser.username || tgUser.first_name);
document.getElementById('userBar').innerText = '👤 ' + username;


/* FIREBASE */
const firebaseConfig = {
apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
authDomain: "freegcash-ads.firebaseapp.com",
databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
projectId: "freegcash-ads",
storageBucket: "freegcash-ads.firebasestorage.app",
messagingSenderId: "608086825364",
appId: "1:608086825364:web:3a8e628d231b52c6171781"
};


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


const userRef = ref(db, 'users/' + uid);


/* INIT USER + REFERRAL */
const params = new URLSearchParams(window.location.search);
const referrer = params.get('ref');


get(userRef).then(s=>{
if(!s.exists()){
set(userRef,{
username,
balance:0,
referrer: referrer || null,
created: Date.now()
});
}
});


onValue(userRef,s=>{
if(s.exists()){
document.getElementById('balanceBar').innerText = '💰 Balance: ₱' + s.val().balance.toFixed(2);
}
});


/* NAV */
window.openPage = p =>{
document.querySelectorAll('[id^="page-"]').forEach(e=>e.classList.add('hidden'));
document.getElementById('page-'+p).classList.remove('hidden');
render(p);
};


/* REWARD ENGINE */
async function reward(amount,key,cd){
const now = Date.now();
const cdRef = ref(db,'cooldowns/'+uid+'/'+key);
const cdSnap = await get(cdRef);
if(cdSnap.exists() && now < cdSnap.val()) return alert('⏳ Cooldown active');


await runTransaction(userRef, u => {
if(!u) return u;
u.balance += amount;
return u;
});


// referral 10%
};
