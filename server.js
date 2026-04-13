const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// 🔹 Supabase
const SUPABASE_URL = "https://kxoztgtalloqqcaboqnb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4b3p0Z3RhbGxvcXFjYWJvcW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTY4ODIsImV4cCI6MjA5MTU5Mjg4Mn0.7qPHmJrv0j3bBfBa7ktNJ7DV3hg8gurOzzsdaXa0keY";

// 🔐 Load private key
const privateKey = fs.readFileSync(
  path.join(__dirname, "private.pem"),
  "utf8"
);

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
  res.send("Hybrid Encryption Server 🔐");
});

// 🔹 Main route
app.post("/data", async (req, res) => {
  try {
    const { data, key } = req.body;

    // 🔐 RSA decrypt AES key
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(key, "base64")
    ).toString("utf-8");

    // 🔐 AES decrypt data
    const decrypted = decryptAES(data, aesKey);

    const [name, msg] = decrypted.split(",").map(v => v.trim());

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

    const db = await response.json();

    const found = db.some(row =>
      row.name?.toLowerCase() === name.toLowerCase() &&
      row.message?.toString().trim() === msg
    );

    if (found) {
      res.json({ reply: "VALID USER ✅" });
    } else {
      res.json({ reply: "INVALID USER ❌" });
    }

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
