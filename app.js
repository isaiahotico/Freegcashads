import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tele = window.Telegram.WebApp;

// Game State
let userData = {
    balance: 0.00,
    ink: 100,
    multiplier: 1,
    lastSync: Date.now()
};

// Use Telegram ID or a fallback for testing
const userId = tele.initDataUnsafe?.user?.id || "guest_user";

// --- MONETAG ADS INTEGRATION ---

// 1. In-App Interstitials (Auto-run)
show_10337795({
  type: 'inApp',
  inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
});

// 2. Rewarded Ad: Refill Ink
window.watchRefillAd = function() {
    show_10337795().then(() => {
        userData.ink = 100;
        updateUI();
        saveToFirebase();
        alert("Ink Refilled! Keep printing Pesos.");
    });
};

// 3. Rewarded Popup: Double Earnings
window.watchDoubleAd = function() {
    show_10337795('pop').then(() => {
        userData.multiplier = 2;
        updateUI();
        setTimeout(() => { userData.multiplier = 1; updateUI(); }, 60000); // 1 min boost
        alert("2x Boost active for 60 seconds!");
    });
};

// --- CORE LOGIC ---

async function initGame() {
    tele.ready();
    tele.expand();

    // Load Data from Firebase
    const userRef = ref(db, 'users/' + userId);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
        userData = { ...userData, ...snapshot.val() };
    } else {
        await set(userRef, userData);
    }
    
    document.getElementById('loading').style.display = 'none';
    updateUI();
}

function updateUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(2);
    document.getElementById('ink').innerText = Math.floor(userData.ink);
}

function saveToFirebase() {
    const userRef = ref(db, 'users/' + userId);
    update(userRef, userData);
}

// Click/Tap Logic
document.getElementById('printBtn').addEventListener('click', () => {
    if (userData.ink > 0) {
        let earnings = 0.50 * userData.multiplier; // 0.50 Peso per tap
        userData.balance += earnings;
        userData.ink -= 1;
        
        // Haptic feedback for Telegram
        tele.HapticFeedback.impactOccurred('light');
        
        updateUI();
        
        // Save every 10 clicks to save Firebase bandwidth
        if (Math.floor(userData.balance) % 5 === 0) {
            saveToFirebase();
        }
    } else {
        tele.showAlert("Out of Ink! Watch an ad to refill.");
    }
});

// Start the game
initGame();
