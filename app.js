
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const OWNER_ID = "PASTE_YOUR_TELEGRAM_ID_HERE"; // Put your ID here
const user = tg.initDataUnsafe?.user || { id: "test_user", first_name: "Local" };
const userId = user.id.toString();

// UI Switching
window.showPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav div').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(pageId).classList.add('active');
    document.getElementById('nav-' + pageId).classList.add('active-nav');
};

// Initial Sync
async function init() {
    if(userId === OWNER_ID) document.getElementById('nav-admin').style.display = 'block';
    document.getElementById('user-display').innerText = `Welcome, ${user.first_name}`;
    
    // Real-time Balance Sync
    onSnapshot(doc(db, "users", userId), (doc) => {
        if (doc.exists()) {
            document.getElementById('balance').innerText = `₱ ${doc.data().balance.toFixed(3)}`;
        } else {
            setDoc(doc(db, "users", userId), { balance: 0, username: user.first_name, lastChat: 0 });
        }
    });

    // Real-time Chat Sync
    const chatQuery = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(50));
    onSnapshot(chatQuery, (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = '';
        snapshot.docs.reverse().forEach(msgDoc => {
            const data = msgDoc.data();
            const div = document.createElement('div');
            div.className = `msg ${data.uid === userId ? 'me' : 'others'}`;
            div.innerHTML = `<span class="msg-info">${data.name}</span>${data.text}`;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    // Admin Panel Sync
    if(userId === OWNER_ID) {
        onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (snap) => {
            const container = document.getElementById('pending-withdrawals');
            container.innerHTML = '';
            snap.forEach(d => {
                const w = d.data();
                container.innerHTML += `
                    <div class="withdraw-item">
                        <span>₱${w.amount} to ${w.gcash} (${w.name})</span>
                        <button class="btn" style="width:80px" onclick="approveWithdrawal('${d.id}', '${w.uid}')">Approve</button>
                    </div>`;
            });
        });
    }
}

// ADSGRAM Logic
window.playAdsgram = async (blockId) => {
    const AdController = window.AdsGram.init({ blockId });
    AdController.show().then(() => reward(0.02)).catch(() => tg.showAlert("Ad skipped. No reward."));
};

// MONETAG Logic (Combined 3 ads for chat)
window.sendChatMessage = async () => {
    const text = document.getElementById('chat-input').value;
    const userDoc = await getDoc(doc(db, "users", userId));
    const now = Date.now();

    if(!text) return;
    if(userDoc.data().lastChat && now - userDoc.data().lastChat < 180000) {
        return tg.showAlert("Cooldown active! Wait 3 minutes.");
    }

    tg.showConfirm("Watch 3 Ads to send this message?", async (ok) => {
        if(ok) {
            try {
                tg.MainButton.setText("Loading Ad 1/3...").show();
                await show_10337853();
                tg.MainButton.setText("Loading Ad 2/3...");
                await show_10337795();
                tg.MainButton.setText("Loading Ad 3/3...");
                await show_10276123();
                
                // Reward and Send
                await addDoc(collection(db, "messages"), {
                    uid: userId, name: user.first_name, text: text, createdAt: serverTimestamp()
                });
                await updateDoc(doc(db, "users", userId), { 
                    balance: increment(0.015), 
                    lastChat: now 
                });
                document.getElementById('chat-input').value = '';
                tg.MainButton.hide();
            } catch (e) {
                tg.showAlert("Ad error. Failed to send.");
                tg.MainButton.hide();
            }
        }
    });
};

// Withdrawal Logic
window.requestWithdrawal = async () => {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const gcash = document.getElementById('gcash-num').value;
    const userSnap = await getDoc(doc(db, "users", userId));

    if(amount < 0.02 || amount > userSnap.data().balance) return tg.showAlert("Invalid amount or balance.");
    if(!gcash) return tg.showAlert("Enter GCash number.");

    await addDoc(collection(db, "withdrawals"), {
        uid: userId, name: user.first_name, amount, gcash, status: "pending", createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "users", userId), { balance: increment(-amount) });
    tg.showAlert("Withdrawal requested!");
};

window.approveWithdrawal = async (docId) => {
    await updateDoc(doc(db, "withdrawals", docId), { status: "approved" });
    tg.showAlert("Approved!");
};

async function reward(amt) {
    await updateDoc(doc(db, "users", userId), { balance: increment(amt) });
    tg.HapticFeedback.notificationOccurred('success');
}

init();
