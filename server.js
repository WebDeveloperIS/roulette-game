const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "users.json");

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

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/api/leaderboard", (req, res) => {
    const users = Object.values(loadUsers());
    const topPlayers = users
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 5)
        .map((user) => ({ username: user.username, balance: user.balance }));
    res.json({ topPlayers });
});

app.get("/api/user/:username", (req, res) => {
    const users = loadUsers();
    const username = req.params.username;
    const user = users[username];
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    res.json({ user: safeUser(user) });
});

app.post("/api/user/:username/balance", (req, res) => {
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
    user.balance = balance;
    users[username] = user;
    saveUsers(users);
    res.json({ balance: user.balance });
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
    res.json({ user: safeUser(user) });
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

app.delete("/api/user/:username", (req, res) => {
    const username = req.params.username;
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
