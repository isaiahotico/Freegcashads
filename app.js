
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const tg = window.Telegram?.WebApp;
const rawUser = tg?.initDataUnsafe?.user?.username || tg?.initDataUnsafe?.user?.first_name || "Guest";
const userDocId = rawUser.replace(/\s+/g, '_');

let uData = { balance: 0, cooldowns: {} };
let currentTopicId = null;

function init() {
    document.getElementById('uName').innerText = "👤 " + rawUser;
    
    // Global Auto Ads
    setInterval(() => {
        show_10276123({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }});
    }, 360000);

    // Sync User
    db.collection('users').doc(userDocId).onSnapshot(doc => {
        if(doc.exists) {
            uData = doc.data();
            document.getElementById('uBal').innerText = "₱" + (uData.balance || 0).toFixed(3);
        } else {
            db.collection('users').doc(userDocId).set({ balance: 0, cooldowns: {} });
        }
    });

    renderTaskButtons();
    loadWithdrawals();
    loadTopics();
}

// --- REWARD LOGIC ---
function renderTaskButtons() {
    const config = [
        { id: 'list-ads', type: 'ads', count: 3, rew: 0.02, cd: 300, zones: [10276123, 10337795, 10337853] },
        { id: 'list-signin', type: 'signin', count: 3, rew: 0.025, cd: 3600, zones: [10276123, 10337795, 10337853] },
        { id: 'list-gift', type: 'gift', count: 3, rew: 0.02, cd: 10800, zones: [10276123, 10337795, 10337853], pop: true }
    ];

    config.forEach(cat => {
        let html = `<h4>${cat.type.toUpperCase()} AREA</h4>`;
        for(let i=1; i<=cat.count; i++) {
            html += `<div class="card"><b>Task #${i}</b><br>
            <button class="btn" id="btn-${cat.type}-${i}" onclick="runTask('${cat.type}', ${i}, ${cat.zones[i-1]}, ${cat.rew}, ${cat.cd}, ${cat.pop || false})">Unlock ₱${cat.rew}</button>
            <div class="timer" id="tm-${cat.type}-${i}">Ready</div></div>`;
        }
        document.getElementById(cat.id).innerHTML = html;
    });
}

async function runTask(type, id, zone, rew, cd, isPop) {
    const key = `${type}_${id}`;
    if(uData.cooldowns?.[key] > Date.now()) return alert("Cooldown!");
    try {
        if(isPop) await window['show_'+zone]('pop'); else await window['show_'+zone]();
        await db.collection('users').doc(userDocId).update({
            balance: firebase.firestore.FieldValue.increment(rew),
            [`cooldowns.${key}`]: Date.now() + (cd * 1000)
        });
        alert("🎉 Reward Added!");
    } catch(e) { alert("Ad incomplete"); }
}

// --- TOPICS SYSTEM ---
async function createTopic() {
    const title = document.getElementById('topicInp').value;
    if(!title) return;
    await db.collection('topics').add({ title, author: rawUser, time: Date.now() });
    document.getElementById('topicInp').value = "";
}

function loadTopics() {
    db.collection('topics').orderBy('time', 'desc').limit(15).onSnapshot(snap => {
        const cont = document.getElementById('topic-container');
        cont.innerHTML = snap.docs.map(doc => `
            <div class="topic-item" onclick="viewTopic('${doc.id}', '${doc.data().title}')">
                <b>${doc.data().title}</b><br>
                <small>By ${doc.data().author} • ${new Date(doc.data().time).toLocaleDateString()}</small>
            </div>
        `).join('');
    });
}

function viewTopic(id, title) {
    currentTopicId = id;
    document.getElementById('topic-list-view').style.display = 'none';
    document.getElementById('topic-detail-view').style.display = 'block';
    document.getElementById('active-topic-content').innerHTML = `<h3>${title}</h3>`;
    
    db.collection('topics').doc(id).collection('comments').orderBy('time', 'asc').onSnapshot(snap => {
        document.getElementById('comments-container').innerHTML = snap.docs.map(d => `
            <div class="comment-item"><b>${d.data().user}:</b> ${d.data().text}</div>
        `).join('');
    });
}

function backToTopics() {
    document.getElementById('topic-list-view').style.display = 'block';
    document.getElementById('topic-detail-view').style.display = 'none';
}

async function postReply() {
    const text = document.getElementById('replyInp').value;
    if(!text) return;
    await db.collection('topics').doc(currentTopicId).collection('comments').add({
        user: rawUser, text, time: Date.now()
    });
    document.getElementById('replyInp').value = "";
}

// --- WITHDRAWALS ---
async function submitWithdraw() {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const addr = document.getElementById('wAddr').value;
    if(amt > uData.balance || amt < 1) return alert("Min 1 PHP");

    await db.collection('withdrawals').add({ user: rawUser, addr, amt, status: 'pending', time: Date.now() });
    await db.collection('users').doc(userDocId).update({ balance: firebase.firestore.FieldValue.increment(-amt) });
    alert("Request Live!");
}

function loadWithdrawals() {
    db.collection('withdrawals').orderBy('time', 'desc').onSnapshot(snap => {
        let h = '<table><tr><th>User</th><th>Amount</th><th>Status</th></tr>';
        snap.forEach(d => {
            const data = d.data();
            h += `<tr><td>${data.user}</td><td>₱${data.amt}</td><td>${data.status}</td></tr>`;
        });
        document.getElementById('wHistory').innerHTML = h + '</table>';
    });
}

// --- UI HELPERS ---
function showPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(p).classList.add('active');
}

setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('.timer').forEach(el => {
        const id = el.id.replace('tm-', '').replace('-', '_');
        const target = uData.cooldowns?.[id] || 0;
        if(target > now) {
            el.innerText = Math.ceil((target-now)/1000) + "s";
            el.previousElementSibling.disabled = true;
        } else {
            el.innerText = "Ready!";
            el.previousElementSibling.disabled = false;
        }
    });
    document.getElementById('footer-time').innerText = new Date().toLocaleString();
}, 1000);

init();
