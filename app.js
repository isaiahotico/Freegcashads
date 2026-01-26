<span class="text-[10px] font-bold text-amber-800">TOTAL REF EARNINGS:</span>
                    <span class="font-black text-amber-900">₱ <span id="total-ref-earning">0.00</span></span>
                </div>
            </div>

            <div class="bg-white rounded-3xl p-5 shadow-sm">
                <h3 class="font-bold text-gray-700 text-sm mb-3">RECENT PAYOUT HISTORY</h3>
                <div id="payout-history" class="space-y-3"></div>
            </div>
        </section>

        <!-- OWNER TAB -->
        <section id="owner-view" class="tab-content">
            <div id="owner-auth" class="bg-white p-8 rounded-3xl shadow-xl text-center">
                <h2 class="font-black text-xl mb-4">OWNER ACCESS</h2>
                <input type="password" id="owner-pass" placeholder="Password" class="w-full border p-3 rounded-xl mb-4 text-center">
                <button onclick="loginOwner()" class="w-full bg-black text-white py-3 rounded-xl font-bold">LOGIN</button>
            </div>
            <div id="owner-panel" class="hidden space-y-4">
                <div class="bg-red-600 text-white p-4 rounded-2xl font-black flex justify-between">
                    <span>PENDING REQUESTS</span>
                    <i class="fas fa-crown"></i>
                </div>
                <div id="owner-request-list" class="space-y-3"></div>
            </div>
        </section>

    </main>

    <!-- Navigation -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 z-50">
        <button onclick="showTab('earn')" id="nav-earn" class="nav-btn active flex flex-col items-center text-gray-400">
            <i class="fas fa-home text-xl"></i><span class="text-[10px] font-bold">Earn</span>
        </button>
        <button onclick="showTab('chat')" id="nav-chat" class="nav-btn flex flex-col items-center text-gray-400">
            <i class="fas fa-comments text-xl"></i><span class="text-[10px] font-bold">Chat</span>
        </button>
        <button onclick="showTab('wallet')" id="nav-wallet" class="nav-btn flex flex-col items-center text-gray-400">
            <i class="fas fa-wallet text-xl"></i><span class="text-[10px] font-bold">Wallet</span>
        </button>
        <button onclick="showTab('owner')" id="nav-owner" class="nav-btn flex flex-col items-center text-gray-400">
            <i class="fas fa-user-shield text-xl"></i><span class="text-[10px] font-bold">Owner</span>
        </button>
    </nav>

    <script type="module" src="app.js"></script>
</body>
</html>
