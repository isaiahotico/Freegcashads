// 1. Firebase Configuration (REPLACE WITH YOUR KEYS)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_ID",
    appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 2. Telegram Integration
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.floor(Math.random()*1000);
document.getElementById("userBar").innerText = "👤 " + username;

// 3. App State
let userBalance = parseFloat(localStorage.getItem('balance') || '0');
let lastSentTime = parseInt(localStorage.getItem('lastSent') || '0');
updateUI();

// 4. Background Cycler
const colors = ["pink", "green", "blue", "red", "violet", "yellow", "yellowgreen", "orange", "white", "cyan", "brown", "bricks"];
let colorIndex = 0;

document.getElementById('aide-box').addEventListener('click', () => {
    const body = document.body;
    const color = colors[colorIndex];
    
    // Reset classes
    body.classList.remove('brick-bg');
    body.style.backgroundColor = "";
    body.style.color = "white";

    if (color === 'bricks') {
        body.classList.add('brick-bg');
    } else {
        body.style.backgroundColor = color;
        // Text contrast
        if(['white', 'yellow', 'cyan', 'yellowgreen'].includes(color)) body.style.color = "black";
    }
    
    colorIndex = (colorIndex + 1) % colors.length;
});

// 5. Chat Logic
function toggleChat() {
    const chat = document.getElementById('chat-page');
    const btn = document.getElementById('chat-toggle-btn');
    if (chat.style.display === "none" || chat.style.display === "") {
        chat.style.display = "flex";
        btn.innerText = "✖ CLOSE CHAT";
        loadMessages();
    } else {
        chat.style.display = "none";
        btn.innerText = "📙 OPEN ADVANCED CHAT 📘";
    }
}

async function handleSendMessage() {
    const text = document.getElementById('msgInput').value;
    const now = Date.now();

    if (!text) return alert("Message cannot be empty");
    if (now - lastSentTime < 180000) { // 3 minutes cooldown
        const remaining = Math.ceil((180000 - (now - lastSentTime)) / 1000);
        return alert(`Cooldown active. Wait ${remaining}s`);    }

    try {
        tg.MainButton.setText("SHOWING AD 1/3...").show();
        await show_10276123(); // Monetag Ad 1
        
        tg.MainButton.setText("SHOWING AD 2/3...");
        await show_10337795(); // Monetag Ad 2
        
        tg.MainButton.setText("SHOWING AD 3/3...");
        await show_10337853(); // Monetag Ad 3

        // Reward and Send
        userBalance += 0.015;
        lastSentTime = now;
        
        db.ref('messages').push({
            username: username,
            text: text,
            timestamp: now
        });

        localStorage.setItem('balance', userBalance);
        localStorage.setItem('lastSent', lastSentTime);
        document.getElementById('msgInput').value = "";
        updateUI();
        tg.MainButton.hide();
        alert("Message Sent! Earned ₱0.015");

    } catch (err) {
        alert("Ad failed or was skipped. You must watch all 3 to send.");
        tg.MainButton.hide();
    }
}

function loadMessages() {
    db.ref('messages').limitToLast(50).on('value', (snapshot) => {
        const container = document.getElementById('messages');
        container.innerHTML = "";
        snapshot.forEach((child) => {
            const data = child.val();
            container.innerHTML += `
                <div class="msg">
                    <div class="msg-user">${data.username}</div>
                    <div class="msg-text">${data.text}</div>
                </div>
            `;
        });
        container.scrollTop = container.scrollHeight;
    });
}

// 6. Maintenance & Utilities
function updateUI() {
    document.getElementById('balance-val').innerText = userBalance.toFixed(3);
    document.getElementById('current-time').innerText = new Date().toLocaleString();
}

// Auto-delete older than 3 days logic (Triggered by any user once per day)
function cleanupOldMessages() {
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    db.ref('messages').orderByChild('timestamp').endAt(threeDaysAgo).once('value', (snapshot) => {
        snapshot.forEach((child) => child.ref.remove());
    });
}
cleanupOldMessages();

setInterval(updateUI, 1000);
