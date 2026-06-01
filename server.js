const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "users.json");
const sessions = {};

function loadUsers() {
    if (!fs.existsSync(DATA_FILE)) {
        return {};
    }
    try {
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.error("Failed to load users:", error);
        return {};
    }
}

function saveUsers(users) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), "utf8");
}

function safeUser(user) {
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
}

function createSession(username) {
    const token = crypto.randomBytes(24).toString("hex");
    sessions[token] = { username, created: Date.now() };
    return token;
}

function getSessionUsername(token) {
    return token && sessions[token] ? sessions[token].username : null;
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const username = getSessionUsername(token);
    if (!username) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const users = loadUsers();
    const user = users[username];
    if (!user) {
        return res.status(401).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
}

function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
}

function ensureAdminUser() {
    const users = loadUsers();
    if (!Object.values(users).some((user) => user.role === "admin")) {
        users.admin = {
            username: "admin",
            password: "admin",
            balance: 0,
            role: "admin",
            lastPlayed: Date.now(),
        };
        saveUsers(users);
        console.log("Created default admin account: admin/admin");
    }
}

ensureAdminUser();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/api/leaderboard", (req, res) => {
    const users = Object.values(loadUsers()).filter((user) => user.role !== "admin");
    const topPlayers = users
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 5)
        .map((user) => ({ username: user.username, balance: user.balance }));
    res.json({ topPlayers });
});

app.get("/api/me", authenticate, (req, res) => {
    res.json({ user: safeUser(req.user) });
});

app.get("/api/user/:username", authenticate, (req, res) => {
    const users = loadUsers();
    const username = req.params.username;
    const user = users[username];
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    if (req.user.username !== username && req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }
    res.json({ user: safeUser(user) });
});

app.post("/api/user/:username/balance", authenticate, (req, res) => {
    const { balance } = req.body;
    if (typeof balance !== "number" || Number.isNaN(balance)) {
        return res.status(400).json({ message: "Invalid balance" });
    }
    const users = loadUsers();
    const username = req.params.username;
    const user = users[username];
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    if (req.user.username !== username && req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }
    user.balance = balance;
    users[username] = user;
    saveUsers(users);
    res.json({ balance: user.balance });
});

app.post("/api/admin/users", authenticate, adminOnly, (req, res) => {
    const users = Object.values(loadUsers()).map((user) => safeUser(user));
    res.json({ users });
});

app.post("/api/admin/user", authenticate, adminOnly, (req, res) => {
    const { username, password, role = "player", balance = 100 } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
    }
    const users = loadUsers();
    if (users[username]) {
        return res.status(409).json({ message: "Username already exists" });
    }
    users[username] = {
        username,
        password,
        balance: typeof balance === "number" && balance >= 0 ? balance : 100,
        role: role === "admin" ? "admin" : "player",
        lastPlayed: Date.now(),
    };
    saveUsers(users);
    res.json({ message: "User created" });
});

app.post("/api/admin/user/:username/password", authenticate, adminOnly, (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
    }
    const users = loadUsers();
    const username = req.params.username;
    const user = users[username];
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    user.password = newPassword;
    users[username] = user;
    saveUsers(users);
    res.json({ message: "Password updated" });
});

app.post("/api/admin/user/:username/balance", authenticate, adminOnly, (req, res) => {
    const { amount, operation } = req.body;
    if (typeof amount !== "number" || Number.isNaN(amount) || amount < 0) {
        return res.status(400).json({ message: "Invalid amount" });
    }
    const users = loadUsers();
    const username = req.params.username;
    const user = users[username];
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    if (operation === "add") {
        user.balance += amount;
    } else if (operation === "subtract") {
        user.balance = Math.max(0, user.balance - amount);
    } else if (operation === "set") {
        user.balance = amount;
    } else {
        return res.status(400).json({ message: "Invalid operation" });
    }
    users[username] = user;
    saveUsers(users);
    res.json({ balance: user.balance });
});

app.delete("/api/admin/user/:username", authenticate, adminOnly, (req, res) => {
    const username = req.params.username;
    const users = loadUsers();
    if (!users[username]) {
        return res.status(404).json({ message: "User not found" });
    }
    delete users[username];
    saveUsers(users);
    res.json({ message: "User deleted" });
});

app.post("/api/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
    }
    const users = loadUsers();
    if (users[username]) {
        return res.status(409).json({ message: "Username already exists" });
    }
    users[username] = {
        username,
        password,
        balance: 100,
        role: "player",
        lastPlayed: Date.now(),
    };
    saveUsers(users);
    res.json({ message: "Registered successfully" });
});

app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
    }
    const users = loadUsers();
    const user = users[username];
    if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
    }
    const token = createSession(username);
    res.json({ user: safeUser(user), token });
});

app.post("/api/reset-password", (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
    }
    const users = loadUsers();
    const user = users[username];
    if (!user || user.password !== currentPassword) {
        return res.status(401).json({ message: "Invalid username or current password" });
    }
    user.password = newPassword;
    users[username] = user;
    saveUsers(users);
    res.json({ message: "Password updated" });
});

app.delete("/api/user/:username", authenticate, (req, res) => {
    const username = req.params.username;
    if (req.user.username !== username && req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }
    const users = loadUsers();
    if (!users[username]) {
        return res.status(404).json({ message: "User not found" });
    }
    delete users[username];
    saveUsers(users);
    res.json({ message: "User deleted" });
});

app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
});

app.listen(PORT, () => {
    console.log(`Roulette backend running on http://localhost:${PORT}`);
});
