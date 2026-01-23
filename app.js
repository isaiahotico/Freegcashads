// 1. Initialize Telegram
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const myUser = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || "Guest";
document.getElementById('my-username').innerText = `@${myUser}`;

// 2. Firebase Config (Paper House Inc)
const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d",
  databaseURL: "https://paper-house-inc-default-rtdb.firebaseio.com" // Standard URL for your Project ID
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 3. Game State
let board = null;
let game = new Chess();
let userRole = null; // 'white', 'black', or 'spectator'

// Get Game ID from URL or create a default one
const urlParams = new URLSearchParams(window.location.search);
let gameId = urlParams.get('gameId') || 'lobby_1';
document.getElementById('gameIdDisplay').innerText = `Room: ${gameId}`;

const gameRef = db.ref('games/' + gameId);

// 4. Board Logic
function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    
    // Only allow moving your own pieces
    if (userRole === 'white' && piece.search(/^b/) !== -1) return false;
    if (userRole === 'black' && piece.search(/^w/) !== -1) return false;
    
    // Only allow moving on your turn
    if ((game.turn() === 'w' && userRole !== 'white') || 
        (game.turn() === 'b' && userRole !== 'black')) return false;
}

function onDrop(source, target) {
    let move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    // Update Firebase
    gameRef.update({
        fen: game.fen(),
        lastMove: Date.now()
    });
}

function onSnapEnd() {
    board.position(game.fen());
}

// 5. Sync with Firebase
gameRef.on('value', (snapshot) => {
    const data = snapshot.val();
    
    if (!data) {
        // Initialize new game if none exists
        gameRef.set({
            fen: 'start',
            white: myUser,
            black: null
        });
        return;
    }

    // Role Assignment
    if (data.white === myUser) {
        userRole = 'white';
    } else if (data.black === myUser) {
        userRole = 'black';
    } else if (!data.black) {
        // Join as Black if slot is empty
        gameRef.update({ black: myUser });
        userRole = 'black';
    } else {
        userRole = 'spectator';
    }

    // Update Board
    game.load(data.fen || 'start');
    board.position(game.fen());
    board.orientation(userRole === 'black' ? 'black' : 'white');

    // Update UI
    document.getElementById('player-white').innerText = `White: ${data.white || '?'}`;
    document.getElementById('player-black').innerText = `Black: ${data.black || '?'}`;
    updateStatus();
});

function updateStatus() {
    let status = '';
    let moveColor = game.turn() === 'b' ? 'Black' : 'White';

    if (game.in_checkmate()) {
        status = 'Game over! ' + moveColor + ' is in checkmate.';
    } else if (game.in_draw()) {
        status = 'Game over, Draw';
    } else {
        status = moveColor + ' to move';
        if (game.in_check()) status += ' (Check!)';
    }
    
    if (userRole === 'spectator') status += " [Spectating]";
    document.getElementById('status').innerText = status;
}

function shareGame() {
    const inviteLink = `https://t.me/YOUR_BOT_USERNAME/app_name?startapp=${gameId}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=Play chess with me!`);
}

// 6. Init Board
board = ChessBoard('board', {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
});
