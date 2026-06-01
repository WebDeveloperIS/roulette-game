const authCard = document.getElementById("authCard");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginUsernameEl = document.getElementById("loginUsername");
const loginPasswordEl = document.getElementById("loginPassword");
const registerUsernameEl = document.getElementById("registerUsername");
const registerPasswordEl = document.getElementById("registerPassword");
const resetTab = document.getElementById("resetTab");
const resetForm = document.getElementById("resetForm");
const resetUsernameEl = document.getElementById("resetUsername");
const resetCurrentPasswordEl = document.getElementById("resetCurrentPassword");
const resetNewPasswordEl = document.getElementById("resetNewPassword");
const resetPasswordButton = document.getElementById("resetPasswordButton");
const playerInfo = document.getElementById("playerInfo");
const playerNameEl = document.getElementById("playerName");
const playerRoleEl = document.getElementById("playerRole");
const logoutButton = document.getElementById("logoutButton");
const deleteAccountButton = document.getElementById("deleteAccountButton");
const leaderboardEl = document.getElementById("leaderboard");
const adminPanel = document.getElementById("adminPanel");
const adminCreateUsernameEl = document.getElementById("adminCreateUsername");
const adminCreatePasswordEl = document.getElementById("adminCreatePassword");
const adminCreateButton = document.getElementById("adminCreateButton");
const adminUserTableBody = document.querySelector("#adminUserTable tbody");
const gameArea = document.getElementById("gameArea");
const balanceEl = document.getElementById("balance");
const betAmountEl = document.getElementById("betAmount");
const betTypeEl = document.getElementById("betType");
const betRangeEl = document.getElementById("betRange");
const numberBetRow = document.getElementById("numberBetRow");
const topupCard = document.getElementById("topupCard");
const topupAmountEl = document.getElementById("topupAmount");
const addBalanceButton = document.getElementById("addBalanceButton");
const spinButton = document.getElementById("spinButton");
const resetButton = document.getElementById("resetButton");
const resultEl = document.getElementById("result");
const outcomeNumberEl = document.getElementById("outcomeNumber");
const outcomeColorEl = document.getElementById("outcomeColor");
const wheelEl = document.getElementById("wheel");
const wheelNumberEl = document.getElementById("wheelNumber");
const wheelColorEl = document.getElementById("wheelColor");
const historyEl = document.getElementById("history");
const chatMessagesEl = document.getElementById("chatMessages");
const chatInputEl = document.getElementById("chatInput");
const chatSendButton = document.getElementById("chatSendButton");
const adminChatMessagesEl = document.getElementById("adminChatMessages");
const adminChatInputEl = document.getElementById("adminChatInput");
const adminChatSendButton = document.getElementById("adminChatSendButton");
const adminChatRefreshButton = document.getElementById("adminChatRefreshButton");

let currentUser = null;
let authToken = null;
const CURRENT_USER_KEY = "roulette-current-token";
let currentBalance = 100;
const TOPUP_LIMIT = 10000;
const BALANCE_CAP = 50000;
const historyLimit = 5;

async function apiRequest(path, options = {}) {
    const headers = { "Content-Type": "application/json" };
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }
    const response = await fetch(path, {
        headers,
        credentials: "same-origin",
        ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || "Server error");
    }
    return data;
}

async function updateLeaderboard() {
    try {
        const data = await apiRequest("/api/leaderboard", { method: "GET" });
        leaderboardEl.innerHTML = "";
        data.topPlayers.forEach((player) => {
            const li = document.createElement("li");
            li.textContent = `${player.username} — ${player.balance}`;
            leaderboardEl.appendChild(li);
        });
    } catch (error) {
        console.warn("Leaderboard load failed:", error.message);
    }
}

function showRoleUI() {
    if (!currentUser) return;
    if (currentUser.role === "admin") {
        adminPanel.style.display = "block";
        gameArea.style.display = "none";
        topupCard.style.display = "none";
        playerRoleEl.textContent = "(Admin)";
    } else {
        adminPanel.style.display = "none";
        gameArea.style.display = "block";
        topupCard.style.display = "none";
        playerRoleEl.textContent = "";
    }
}

function setCurrentUser(user) {
    currentUser = user;
    if (!currentUser) return;
    currentBalance = currentUser.balance;
    playerNameEl.textContent = currentUser.username;
    playerInfo.style.display = "flex";
    authCard.style.display = "none";
    updateBalance();
    showRoleUI();
    updateLeaderboard();
    loadChatMessages();
    if (currentUser.role === "admin") {
        updateAdminUsers();
    }
}

async function persistUserBalance() {
    if (!currentUser) return;
    try {
        const data = await apiRequest(`/api/user/${encodeURIComponent(currentUser.username)}/balance`, {
            method: "POST",
            body: JSON.stringify({ balance: currentBalance }),
        });
        currentUser.balance = data.balance;
        updateLeaderboard();
    } catch (error) {
        console.warn("Balance persist failed:", error.message);
    }
}

function logoutUser() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem(CURRENT_USER_KEY);
    gameArea.style.display = "none";
    playerInfo.style.display = "none";
    adminPanel.style.display = "none";
    authCard.style.display = "block";
    showAuthForm("login");
    resultEl.textContent = "Siz chiqdingiz. Qaytadan tizimga kiring.";
}

async function deleteAccount() {
    if (!currentUser) return;
    if (!confirm(`Haqiqatan ${currentUser.username} hisobini o'chirmoqchimisiz?`)) {
        return;
    }
    try {
        await apiRequest(`/api/user/${encodeURIComponent(currentUser.username)}`, {
            method: "DELETE",
        });
        localStorage.removeItem(CURRENT_USER_KEY);
        currentUser = null;
        gameArea.style.display = "none";
        playerInfo.style.display = "none";
        adminPanel.style.display = "none";
        authCard.style.display = "block";
        showAuthForm("login");
        updateLeaderboard();
        alert("Hisob muvaffaqiyatli o'chirildi.");
    } catch (error) {
        alert(error.message);
    }
}

function showAuthForm(type) {
    loginForm.style.display = "none";
    registerForm.style.display = "none";
    resetForm.style.display = "none";
    loginTab.classList.remove("active");
    registerTab.classList.remove("active");
    resetTab.classList.remove("active");

    if (type === "login") {
        loginForm.style.display = "block";
        loginTab.classList.add("active");
    } else if (type === "register") {
        registerForm.style.display = "block";
        registerTab.classList.add("active");
    } else {
        resetForm.style.display = "block";
        resetTab.classList.add("active");
    }
}

async function handleLogin() {
    const username = loginUsernameEl.value.trim();
    const password = loginPasswordEl.value.trim();
    if (!username || !password) {
        alert("Iltimos, foydalanuvchi nomi va parolni kiriting.");
        return;
    }
    try {
        const data = await apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
        });
        authToken = data.token;
        localStorage.setItem(CURRENT_USER_KEY, authToken);
        setCurrentUser(data.user);
    } catch (error) {
        alert(error.message);
    }
}

async function handleRegister() {
    const username = registerUsernameEl.value.trim();
    const password = registerPasswordEl.value.trim();
    if (!username || !password) {
        alert("Iltimos, foydalanuvchi nomi va parolni kiriting.");
        return;
    }
    try {
        await apiRequest("/api/register", {
            method: "POST",
            body: JSON.stringify({ username, password }),
        });
        alert("Ro'yxatdan o'tish muvaffaqiyatli. Endi tizimga kiring.");
        showAuthForm("login");
    } catch (error) {
        alert(error.message);
    }
}

async function handlePasswordReset() {
    const username = resetUsernameEl.value.trim();
    const currentPassword = resetCurrentPasswordEl.value.trim();
    const newPassword = resetNewPasswordEl.value.trim();
    if (!username || !currentPassword || !newPassword) {
        alert("Iltimos, barcha maydonlarni to'ldiring.");
        return;
    }
    try {
        await apiRequest("/api/reset-password", {
            method: "POST",
            body: JSON.stringify({ username, currentPassword, newPassword }),
        });
        alert("Parolingiz muvaffaqiyatli yangilandi. Iltimos, qayta tizimga kiring.");
        showAuthForm("login");
    } catch (error) {
        alert(error.message);
    }
}

async function initializeAuthentication() {
    const token = localStorage.getItem(CURRENT_USER_KEY);
    if (token) {
        authToken = token;
        try {
            const data = await apiRequest("/api/me");
            setCurrentUser(data.user);
            return;
        } catch (error) {
            console.warn("Auto login failed:", error.message);
            authToken = null;
            localStorage.removeItem(CURRENT_USER_KEY);
        }
    }
    updateLeaderboard();
}

function updateBalance() {
    balanceEl.textContent = currentBalance;
}

function getRouletteOutcome() {
    const number = Math.floor(Math.random() * 37);
    let color;
    if (number === 0) {
        color = "green";
    } else if (number % 2 === 0) {
        color = "black";
    } else {
        color = "red";
    }
    return { number, color };
}

function payoutMultiplier(betType) {
    if (betType === "green") return 0;
    if (betType === "range") return 3;
    return 2;
}

function addHistory(message) {
    const li = document.createElement("li");
    li.textContent = message;
    historyEl.prepend(li);
    while (historyEl.children.length > historyLimit) {
        historyEl.removeChild(historyEl.lastChild);
    }
}

function betColorSettings(color) {
    if (color === "red") return { text: "#ff4d4d", wheel: "radial-gradient(circle, #ff4d4d 0%, #700000 60%)" };
    if (color === "black") return { text: "#999", wheel: "radial-gradient(circle, #666 0%, #111 60%)" };
    if (color === "green") return { text: "#47d147", wheel: "radial-gradient(circle, #47d147 0%, #0b3f0b 60%)" };
    return { text: "#fff", wheel: "radial-gradient(circle, #2d2d2d 0%, #131313 65%)" };
}

function showNumberInput() {
    numberBetRow.style.display = betTypeEl.value === "range" ? "grid" : "none";
}

function updateWheelDisplay(number, color) {
    const settings = betColorSettings(color);
    wheelEl.style.background = settings.wheel;
    wheelNumberEl.textContent = number;
    wheelColorEl.textContent = color ? color.toUpperCase() : "-";
    wheelColorEl.style.color = settings.text;
}

function resetGame() {
    currentBalance = 1000;
    if (currentUser) {
        persistUserBalance();
    }
    spinButton.disabled = false;
    resultEl.textContent = "Game reset. Make a bet to start playing.";
    updateBalance();
    historyEl.innerHTML = "";
    betRangeEl.value = "0";
    topupAmountEl.value = "100";
    topupAmountEl.value = "100";
    showNumberInput();
    updateWheelDisplay("-", null);
}

function handleTopup() {
    const amount = parseInt(topupAmountEl.value, 10);
    if (isNaN(amount) || amount < 100) {
        alert("Iltimos, kamida 100 ball balansga qo'shing.");
        return;
    }
    if (amount > TOPUP_LIMIT) {
        alert(`Top-up miqdori maksimal ${TOPUP_LIMIT} dan oshmasligi kerak.`);
        return;
    }
    if (currentBalance + amount > BALANCE_CAP) {
        alert(`Balansingiz maksimal ${BALANCE_CAP} dan oshmasligi kerak.`);
        return;
    }
    currentBalance += amount;
    updateBalance();
    addHistory(`Balancega +${amount} qo'shildi.`);
    resultEl.textContent = `Balansingizga ${amount} qo'shildi.`;
    persistUserBalance();
}

async function updateAdminUsers() {
    if (!currentUser || currentUser.role !== "admin") return;
    try {
        const data = await apiRequest("/api/admin/users", { method: "POST" });
        adminUserTableBody.innerHTML = "";
        data.users.forEach((user) => {
            const row = document.createElement("tr");
            const usernameCell = document.createElement("td");
            usernameCell.textContent = user.username;
            const balanceCell = document.createElement("td");
            balanceCell.textContent = user.balance;
            const roleCell = document.createElement("td");
            roleCell.textContent = user.role || "player";
            const actionsCell = document.createElement("td");
            
            const passButton = document.createElement("button");
            passButton.type = "button";
            passButton.textContent = "Reset PW";
            passButton.addEventListener("click", () => adminSetPassword(user.username));
            
            const addButton = document.createElement("button");
            addButton.type = "button";
            addButton.textContent = "+ Bal";
            addButton.addEventListener("click", () => adminAdjustBalance(user.username, "add"));
            
            const minusButton = document.createElement("button");
            minusButton.type = "button";
            minusButton.textContent = "- Bal";
            minusButton.addEventListener("click", () => adminAdjustBalance(user.username, "subtract"));
            
            const muteButton = document.createElement("button");
            muteButton.type = "button";
            muteButton.textContent = user.muted ? "Unmute" : "Mute";
            muteButton.className = user.muted ? "warning" : "";
            muteButton.addEventListener("click", () => adminToggleMute(user.username, user.muted));
            
            const kickButton = document.createElement("button");
            kickButton.type = "button";
            kickButton.textContent = "Kick";
            kickButton.addEventListener("click", () => adminKickUser(user.username));
            
            const banButton = document.createElement("button");
            banButton.type = "button";
            banButton.textContent = user.banned ? "Unban" : "Ban";
            banButton.className = user.banned ? "danger" : "";
            banButton.addEventListener("click", () => adminToggleBan(user.username, user.banned));
            
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener("click", () => adminDeleteUser(user.username));
            
            actionsCell.appendChild(passButton);
            actionsCell.appendChild(addButton);
            actionsCell.appendChild(minusButton);
            actionsCell.appendChild(muteButton);
            actionsCell.appendChild(kickButton);
            actionsCell.appendChild(banButton);
            actionsCell.appendChild(deleteButton);
            
            row.appendChild(usernameCell);
            row.appendChild(balanceCell);
            row.appendChild(roleCell);
            row.appendChild(actionsCell);
            adminUserTableBody.appendChild(row);
        });
    } catch (error) {
        console.warn("Admin users load failed:", error.message);
    }
}

async function adminCreatePlayer() {
    const username = adminCreateUsernameEl.value.trim();
    const password = adminCreatePasswordEl.value.trim();
    if (!username || !password) {
        alert("Iltimos, yangi foydalanuvchi nomi va parol kiriting.");
        return;
    }
    try {
        await apiRequest("/api/admin/user", {
            method: "POST",
            body: JSON.stringify({ username, password, role: "player", balance: 100 }),
        });
        adminCreateUsernameEl.value = "";
        adminCreatePasswordEl.value = "";
        alert("Yangi foydalanuvchi yaratildi.");
        updateAdminUsers();
        updateLeaderboard();
    } catch (error) {
        alert(error.message);
    }
}

async function adminSetPassword(username) {
    const newPassword = prompt(`Yangi parol kiriting: ${username}`);
    if (!newPassword) return;
    try {
        await apiRequest(`/api/admin/user/${encodeURIComponent(username)}/password`, {
            method: "POST",
            body: JSON.stringify({ newPassword }),
        });
        alert("Parol muvaffaqiyatli yangilandi.");
    } catch (error) {
        alert(error.message);
    }
}

async function adminAdjustBalance(username, operation) {
    const rawAmount = prompt(`Qancha balans ${operation === "add" ? "qo'shmoqchisiz" : "ayirmoqchisiz"}: ${username}`);
    if (!rawAmount) return;
    const amount = parseInt(rawAmount, 10);
    if (isNaN(amount) || amount < 0) {
        alert("Iltimos, to'g'ri son kiriting.");
        return;
    }
    try {
        await apiRequest(`/api/admin/user/${encodeURIComponent(username)}/balance`, {
            method: "POST",
            body: JSON.stringify({ amount, operation }),
        });
        alert("Balans yangilandi.");
        updateAdminUsers();
        updateLeaderboard();
    } catch (error) {
        alert(error.message);
    }
}

async function adminDeleteUser(username) {
    if (!confirm(`${username} hisobini o'chirishni tasdiqlaysizmi?`)) return;
    try {
        await apiRequest(`/api/admin/user/${encodeURIComponent(username)}`, {
            method: "DELETE",
        });
        alert("Foydalanuvchi o'chirildi.");
        if (currentUser && currentUser.username === username) {
            logoutUser();
            return;
        }
        updateAdminUsers();
        updateLeaderboard();
    } catch (error) {
        alert(error.message);
    }
}

async function adminToggleMute(username, isMuted) {
    const endpoint = isMuted ? "unmute" : "mute";
    try {
        await apiRequest(`/api/admin/user/${encodeURIComponent(username)}/${endpoint}`, {
            method: "POST",
        });
        alert(`${username} ${isMuted ? "unmuted" : "muted"} qilindi.`);
        updateAdminUsers();
    } catch (error) {
        alert(error.message);
    }
}

async function adminKickUser(username) {
    if (!confirm(`${username} ni out qilishni tasdiqlaysizmi?`)) return;
    try {
        const response = await apiRequest(`/api/admin/user/${encodeURIComponent(username)}/kick`, {
            method: "POST",
        });
        alert(`${username} out qilindi.`);
        if (currentUser && currentUser.username === username) {
            logoutUser();
            return;
        }
        updateAdminUsers();
    } catch (error) {
        alert(error.message);
    }
}

async function adminToggleBan(username, isBanned) {
    const endpoint = isBanned ? "unban" : "ban";
    if (!isBanned && !confirm(`${username} ni ban qilishni tasdiqlaysizmi?`)) return;
    try {
        const response = await apiRequest(`/api/admin/user/${encodeURIComponent(username)}/${endpoint}`, {
            method: "POST",
        });
        alert(`${username} ${isBanned ? "unbanned" : "banned"} qilindi.`);
        if (!isBanned && currentUser && currentUser.username === username) {
            logoutUser();
            return;
        }
        updateAdminUsers();
    } catch (error) {
        alert(error.message);
    }
}

async function adminDeleteMessage(messageId) {
    if (!confirm("Xabarni o'chirishni tasdiqlaysizmi?")) return;
    try {
        await apiRequest(`/api/admin/chat/${encodeURIComponent(messageId)}`, {
            method: "DELETE",
        });
        loadChatMessages();
    } catch (error) {
        alert(error.message);
    }
}

async function loadChatMessages() {
    try {
        const data = await apiRequest("/api/chat/messages");
        const messagesContainer = currentUser.role === "admin" ? adminChatMessagesEl : chatMessagesEl;
        messagesContainer.innerHTML = "";
        data.messages.forEach((msg) => {
            const messageDiv = document.createElement("div");
            if (currentUser.role === "admin") {
                messageDiv.className = "admin-chat-message";
                const timeStr = new Date(msg.timestamp).toLocaleTimeString();
                const deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.textContent = "✕";
                deleteBtn.className = "admin-delete-msg-btn";
                deleteBtn.addEventListener("click", () => adminDeleteMessage(msg.id));
                messageDiv.innerHTML = `<span class="admin-chat-message-user">${msg.username}</span><span class="admin-chat-message-time">${timeStr}</span>`;
                messageDiv.appendChild(deleteBtn);
                messageDiv.innerHTML += `<br>${msg.message}`;
            } else {
                messageDiv.className = "chat-message";
                messageDiv.innerHTML = `<span class="chat-message-user">${msg.username}</span>: ${msg.message}`;
            }
            messagesContainer.appendChild(messageDiv);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.warn("Chat load failed:", error.message);
    }
}

async function sendChatMessage() {
    const message = chatInputEl.value.trim();
    if (!message) return;
    try {
        await apiRequest("/api/chat/send", {
            method: "POST",
            body: JSON.stringify({ message }),
        });
        chatInputEl.value = "";
        loadChatMessages();
    } catch (error) {
        alert(error.message);
    }
}

async function sendAdminChatMessage() {
    const message = adminChatInputEl.value.trim();
    if (!message) return;
    try {
        await apiRequest("/api/chat/send", {
            method: "POST",
            body: JSON.stringify({ message }),
        });
        adminChatInputEl.value = "";
        loadChatMessages();
    } catch (error) {
        alert(error.message);
    }
}

function refreshAdminChat() {
    loadChatMessages();
}

function startChatPolling() {
    if (currentUser && (currentUser.role === "admin" || currentUser.role === "player")) {
        loadChatMessages();
        setInterval(() => loadChatMessages(), 2000);
    }
}

spinButton.addEventListener("click", () => {
    const bet = parseInt(betAmountEl.value, 10);
    const betType = betTypeEl.value;

    if (isNaN(bet) || bet < 100) {
        alert("Iltimos, kamida 100 ball tikishni kiriting.");
        return;
    }

    if (bet > currentBalance) {
        alert("Sizda yetarli balans yo'q.");
        return;
    }

    let guessedRange = null;
    if (betType === "range") {
        guessedRange = betRangeEl.value;
        const validRanges = ["0", "1-10", "11-20", "21-36"];
        if (!validRanges.includes(guessedRange)) {
            alert("Iltimos, diapazonni tanlang.");
            return;
        }
    }

    spinButton.disabled = true;
    wheelEl.classList.add("spin");
    const { number, color } = getRouletteOutcome();
    const multiplier = payoutMultiplier(betType);
    let won = false;
    if (betType === "range") {
        if (guessedRange === "0") {
            won = number === 0;
        } else if (guessedRange === "1-10") {
            won = number >= 1 && number <= 10;
        } else if (guessedRange === "11-20") {
            won = number >= 11 && number <= 20;
        } else if (guessedRange === "21-36") {
            won = number >= 21 && number <= 36;
        }
    } else {
        won = betType === color;
    }
    let message;

    setTimeout(() => {
        wheelEl.classList.remove("spin");
        if (won) {
            const winAmount = bet * (multiplier - 1);
            currentBalance += winAmount;
            if (betType === "range") {
                message = `Yutuq! ${number} chiqdi - Siz ${winAmount} pul topdingiz.`;
            } else {
                message = `Yutuq! ${number} (${color}) - Siz ${winAmount} pul topdingiz.`;
            }
        } else {
            currentBalance -= bet;
            if (betType === "range") {
                message = `Mag'lubiyat. ${number} chiqdi - Siz ${bet} pul yo'qotdingiz.`;
            } else {
                message = `Mag'lubiyat. ${number} (${color}) - Siz ${bet} pul yo'qotdingiz.`;
            }
        }

        outcomeNumberEl.textContent = number;
        outcomeColorEl.textContent = color.toUpperCase();
        const colorSettings = betColorSettings(color);
        outcomeColorEl.style.color = colorSettings.text;
        resultEl.textContent = message;
        updateWheelDisplay(number, color);
        updateBalance();
        const historyMessage = betType === "range"
            ? `Bet ${bet} on ${guessedRange}, result ${number} (${color}) — ${won ? `+${bet * (multiplier - 1)}` : `-${bet}`}`
            : `Bet ${bet} on ${betType}, result ${number} (${color}) — ${won ? `+${bet * (multiplier - 1)}` : `-${bet}`}`;
        addHistory(historyMessage);

        if (currentBalance <= 0) {
            alert("Sizning balansingiz tugadi. O'yin tugadi.");
            spinButton.disabled = true;
        } else {
            spinButton.disabled = false;
        }
        persistUserBalance();
    }, 1100);
});

loginTab.addEventListener("click", () => showAuthForm("login"));
registerTab.addEventListener("click", () => showAuthForm("register"));
resetTab.addEventListener("click", () => showAuthForm("reset"));

document.getElementById("loginButton").addEventListener("click", handleLogin);
document.getElementById("registerButton").addEventListener("click", handleRegister);
document.getElementById("resetPasswordButton").addEventListener("click", handlePasswordReset);
logoutButton.addEventListener("click", logoutUser);
deleteAccountButton.addEventListener("click", deleteAccount);
adminCreateButton.addEventListener("click", adminCreatePlayer);

betTypeEl.addEventListener("change", showNumberInput);
addBalanceButton.addEventListener("click", handleTopup);
resetButton.addEventListener("click", resetGame);
chatSendButton.addEventListener("click", sendChatMessage);
chatInputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendChatMessage();
    }
});
adminChatSendButton.addEventListener("click", sendAdminChatMessage);
adminChatInputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendAdminChatMessage();
    }
});
adminChatRefreshButton.addEventListener("click", refreshAdminChat);

initializeAuthentication();
showAuthForm("login");
showNumberInput();
updateBalance();
startChatPolling();

