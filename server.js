const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// 🔹 Supabase
const SUPABASE_URL = "https://kxoztgtalloqqcaboqnb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4b3p0Z3RhbGxvcXFjYWJvcW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTY4ODIsImV4cCI6MjA5MTU5Mjg4Mn0.7qPHmJrv0j3bBfBa7ktNJ7DV3hg8gurOzzsdaXa0keY";

// 🔐 Try loading private key (RSA optional)
let privateKey = null;

try {
    privateKey = fs.readFileSync(
        path.join(__dirname, "private.pem"),
        "utf8"
    );
    console.log("Private key loaded ✅");
} catch (err) {
    console.log("No private.pem found → running AES only ⚠️");
}

// 🔐 AES decrypt
function decryptAES(encryptedHex, keyStr) {
    const key = Buffer.from(keyStr);

    const encryptedBuffer = Buffer.from(encryptedHex, "hex");

    const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);
    decipher.setAutoPadding(false);

    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString().replace(/\0/g, "").trim();
}

// 🔹 Home
app.get("/", (req, res) => {
    res.send("Server running with AES 🔐");
});

// 🔹 Main route
app.post("/data", async (req, res) => {
    try {
        let name, msg;

        // 🔥 If RSA data comes (future use)
        if (req.body.data && req.body.key && privateKey) {
            console.log("Using RSA + AES 🔐");

            // 🔐 decrypt AES key using RSA
            const aesKey = crypto.privateDecrypt(
                {
                    key: privateKey,
                    padding: crypto.constants.RSA_PKCS1_PADDING
                },
                Buffer.from(req.body.key, "base64")
            ).toString("utf-8");

            // 🔐 decrypt data
            const decrypted = decryptAES(req.body.data, aesKey);
            [name, msg] = decrypted.split(",").map(v => v.trim());

        } else {
            // 🔥 Current AES-only mode
            const encrypted = req.body.message.toString().trim();

            const decrypted = decryptAES(encrypted, "1234567890123456");

            [name, msg] = decrypted.split(",").map(v => v.trim());
        }

        console.log("Final:", { name, msg });

        // 🔹 Fetch DB
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/messages`,
            {
                method: "GET",
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!Array.isArray(data)) {
            return res.json({ reply: "DB ERROR" });
        }

        const found = data.some(row =>
            row.name?.toLowerCase() === name.toLowerCase() &&
            row.message?.toString().trim() === msg
        );

        if (found) {
            res.json({ reply: "VALID USER ✅" });
        } else {
            res.json({ reply: "INVALID USER ❌" });
        }

    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).send("Server Error");
    }
});

// 🔹 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
