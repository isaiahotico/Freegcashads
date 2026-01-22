import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const MIN_WITHDRAWAL = 50.00;
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;

// --- STATE ---
let userData = {
    uid: "guest",
    name: "User",
    balance: 0.00
};

// --- INITIALIZATION ---
tg.expand();
tg.ready();

const initUser = () => {
    const user = tg.initDataUnsafe?.user;
    if (user) {
        userData.uid = user.id.toString();
        userData.name = user.first_name;
    }
    document.getElementById('user-display').innerText = `Agent: ${userData.name}`;

    // Load/Create Data in Firebase
    const userRef = ref(db, 'users/' + userData.uid);
    onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
            userData.balance = snapshot.val().balance;
            updateUI();
        } else {
            set(userRef, {
                username: userData.name,
                balance: 0.00,
                createdAt: Date.now()
            });
        }
    });
};

const updateUI = () => {
    document.getElementById('balance-val').innerText = userData.balance.toFixed(2);
    const progress = Math.min((userData.balance / 500) * 100, 100);
    document.getElementById('progress-bar').style.width = progress + "%";
    document.getElementById('progress-percent').innerText = Math.floor(progress) + "%";
};

// --- AD HANDLERS ---

// Rewarded Interstitial
window.watchInterstitial = () => {
    show_10276123().then(() => {
        addReward(0.50, "Premium Reward");
    }).catch(e => {
        Swal.fire('Error', 'Ad not available. Try again in 10s.', 'error');
    });
};

// Rewarded Popup
window.watchPopup = () => {
    show_10276123('pop').then(() => {
        addReward(0.20, "Popup Reward");
    });
};

// --- REWARD LOGIC ---
const addReward = (amount, type) => {
    const newBalance = parseFloat((userData.balance + amount).toFixed(2));
    const userRef = ref(db, 'users/' + userData.uid);

    update(userRef, { balance: newBalance }).then(() => {
        Swal.fire({
            title: `+₱${amount}`,
            text: type,
            icon: 'success',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    });
};

// --- WITHDRAWAL ---
window.processWithdrawal = () => {
    const gcash = document.getElementById('gcash-num').value;
    
    if (gcash.length < 11) {
        return Swal.fire('Invalid Number', 'Please enter a valid GCash number.', 'warning');
    }
    
    if (userData.balance < MIN_WITHDRAWAL) {
        return Swal.fire('Low Balance', `Minimum payout is ₱${MIN_WITHDRAWAL}. Keep hunting!`, 'info');
    }

    const withdrawRef = ref(db, 'withdrawals/' + Date.now());
    const payoutData = {
        userId: userData.uid,
        userName: userData.name,
        gcash: gcash,
        amount: userData.balance,
        status: 'pending'
    };

    set(withdrawRef, payoutData).then(() => {
        update(ref(db, 'users/' + userData.uid), { balance: 0.00 });
        Swal.fire('Success', 'Payout request sent! Arriving in 24-48h.', 'success');
    });
};

// --- EVENT LISTENERS ---
document.getElementById('btn-interstitial').addEventListener('click', watchInterstitial);
document.getElementById('btn-popup').addEventListener('click', watchPopup);
document.getElementById('btn-withdraw').addEventListener('click', processWithdrawal);

// Initialize Monetag In-App Interstitial
show_10276123({
  type: 'inApp',
  inAppSettings: {
    frequency: 2,
    capping: 0.1,
    interval: 30,
    timeout: 5,
    everyPage: false
  }
});

initUser();
