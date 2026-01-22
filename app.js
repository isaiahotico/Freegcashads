
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Firebase Configuration ---
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
const db = getFirestore(app);

// --- Telegram WebApp Setup ---
const tg = window.Telegram.WebApp;
tg.ready(); // Important: Signal to Telegram that the app is ready
tg.expand(); // Expand the app to fill the screen

const user = tg.initDataUnsafe?.user;
const userId = user ? user.id.toString() : null; // Use null if no user is available

// --- DOM Elements ---
const usernameEl = document.getElementById('username');
const balanceEl = document.getElementById('balance');
const statusEl = document.getElementById('status');

// --- Initialization ---
async function initializeAppLogic() {
    if (!userId) {
        usernameEl.innerText = "Please use this bot within Telegram.";
        balanceEl.innerText = "-";
        statusEl.innerText = "Login required.";
        // Disable buttons if no user is logged in
        document.querySelectorAll('button').forEach(button => button.disabled = true);
        return;
    }

    // Display username live
    usernameEl.innerText = `Hello, ${user?.first_name || 'User'}!`;

    // Load User Balance from Firestore
    await loadUserBalance();
}

// --- Firestore Functions ---
async function loadUserBalance() {
    if (!userId) return;

    statusEl.innerText = "Loading balance...";
    const userRef = doc(db, "users", userId);

    try {
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            balanceEl.innerText = `₱ ${userData.balance.toFixed(2)}`;
            statusEl.innerText = "Balance loaded.";
        } else {
            // Create user document if it doesn't exist
            await setDoc(userRef, {
                balance: 0,
                username: user?.username || user?.first_name,
                telegramId: user?.id,
                createdAt: serverTimestamp(),
                lastUpdate: serverTimestamp()
            });
            balanceEl.innerText = `₱ 0.00`;
            statusEl.innerText = "Welcome! Your account has been created.";
        }
    } catch (error) {
        console.error("Firestore Error (Loading Balance):", error);
        statusEl.innerText = "Error loading balance.";
        tg.showAlert(`Failed to load balance: ${error.message}`);
    }
}

async function rewardUser() {
    if (!userId) return;

    statusEl.innerText = "Adding reward...";
    const userRef = doc(db, "users", userId);
    const rewardAmount = 0.02;

    try {
        await updateDoc(userRef, {
            balance: increment(rewardAmount),
            lastUpdate: serverTimestamp() // Use serverTimestamp for accuracy
        });

        // Refresh local UI immediately
        balanceEl.innerText = `₱ ${(parseFloat(balanceEl.innerText.replace('₱ ', '')) + rewardAmount).toFixed(2)}`;
        statusEl.innerText = `Reward added! +₱${rewardAmount.toFixed(2)}`;
        tg.HapticFeedback.notificationOccurred('success'); // Success vibration
        
        // Optional: Show a confirmation alert
        // tg.showAlert(`Successfully received ₱${rewardAmount.toFixed(2)}!`);

    } catch (error) {
        console.error("Firestore Error (Reward User):", error);
        statusEl.innerText = "Error saving reward.";
        tg.showAlert(`Failed to add reward: ${error.message}`);
        tg.HapticFeedback.notificationOccurred('error'); // Error vibration
    }
}

// --- AdsGram Logic ---
// Global function to be called by buttons
window.showRewardAd = async function(blockId) {
    if (!userId) {
        statusEl.innerText = "Please log in to Telegram first.";
        tg.showAlert("You need to be logged in within Telegram to use this feature.");
        return;
    }

    console.log(`AdsGram initialized with blockId: ${blockId}`);
    const AdsGram = window.AdsGram || window.SAD; // Use AdsGram or SAD based on SDK availability

    if (!AdsGram) {
        console.error("AdsGram SDK not loaded.");
        statusEl.innerText = "Ads service not available.";
        tg.showAlert("The ads service is currently unavailable. Please try again later.");
        return;
    }

    try {
        const adController = AdsGram.init({ blockId: blockId });
        statusEl.innerText = "Loading ad...";

        // Show the ad. The promise resolves on successful completion or rejects on failure/skip.
        adController.show().then(async (result) => {
            console.log("Ad completed successfully:", result);
            statusEl.innerText = "Ad watched! Verifying reward...";
            await rewardUser(); // Add reward to Firestore and update UI
        }).catch((error) => {
            console.error("Ad failed or was skipped:", error);
            statusEl.innerText = "Ad not finished. No reward.";
            tg.showAlert("You must watch the full ad to receive your ₱0.02 reward.");
            tg.HapticFeedback.notificationOccurred('error');
        });

    } catch (e) {
        console.error("Error initializing or showing ad:", e);
        statusEl.innerText = "Failed to load ad.";
        tg.showAlert(`Could not load ad. Error: ${e.message}`);
        tg.HapticFeedback.notificationOccurred('error');
    }
};

// --- Initial Load ---
initializeAppLogic();

// Optional: Listen for theme changes
tg.onEvent('themeChanged', () => {
    document.body.style.backgroundColor = tg.themeParams.bg_color || '#ffffff';
    document.body.style.color = tg.themeParams.text_color || '#000000';
    // You might want to update button styles dynamically here too if needed
});
