import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Telegram WebApp Setup
const tg = window.Telegram.WebApp;
tg.expand(); // Full screen

// User Data
const user = tg.initDataUnsafe?.user || { id: "guest_user", first_name: "Guest" };
const userId = user.id;
const userRef = ref(db, 'users/' + userId);

// Initialize In-App Interstitials (Auto)
if (typeof show_10276123 === 'function') {
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
}

// Load user balance from Firebase
async function loadBalance() {
    try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            document.getElementById('balance').innerText = snapshot.val().points || 0;
        } else {
            // New User
            await set(userRef, {
                username: user.first_name,
                points: 0
            });
        }
    } catch (error) {
        console.error("Firebase Error:", error);
    }
}

// Update balance function
async function addPoints(amount) {
    try {
        const snapshot = await get(userRef);
        const currentPoints = (snapshot.exists() ? snapshot.val().points : 0);
        const newPoints = currentPoints + amount;
        
        await update(userRef, { points: newPoints });
        document.getElementById('balance').innerText = newPoints;
        tg.HapticFeedback.notificationOccurred('success');
    } catch (error) {
        alert("Error updating points");
    }
}

// Global functions for buttons
window.showRewarded = function() {
    if (typeof show_10276123 === 'function') {
        show_10276123().then(() => {
            addPoints(10);
            tg.showAlert("Success! You earned 10 points.");
        }).catch(e => {
            tg.showAlert("Ad not ready. Try again in a moment.");
        });
    }
};

window.showPopup = function() {
    if (typeof show_10276123 === 'function') {
        show_10276123('pop').then(() => {
            addPoints(5);
        }).catch(e => {
            console.error("Popup error", e);
        });
    }
};

// Initial Load
loadBalance();
