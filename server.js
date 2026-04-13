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
  res.send("Server running 🔐");
});

// 🔹 MAIN ROUTE
app.post("/data", async (req, res) => {
  try {
    const { device_id, token, data, key } = req.body;

    // 🔥 DEBUG LOGS
    console.log("Incoming device_id:", device_id);
    console.log("Incoming token:", token);

    // 🔹 FETCH DEVICES
    const deviceRes = await fetch(`${SUPABASE_URL}/rest/v1/Devices`, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const devices = await deviceRes.json();
    console.log("Devices DB:", devices);

    // 🔥 Ensure array
    if (!Array.isArray(devices)) {
      return res.json({ reply: "DEVICE DB ERROR ❌" });
    }

    // 🔐 DEVICE VALIDATION (FIXED)
    const validDevice = devices.some(d =>
      d.device_id?.trim().toLowerCase() === device_id?.trim().toLowerCase() &&
      d.token?.trim() === token?.trim()
    );

    if (!validDevice) {
      return res.json({ reply: "UNAUTHORIZED DEVICE ❌" });
    }

    console.log("Device verified ✅");

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

    // 🔹 FETCH USERS
    const response = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const db = await response.json();

    if (!Array.isArray(db)) {
      return res.json({ reply: "DB ERROR ❌" });
    }

    // 🔹 MATCH USER
    const found = db.some(row =>
      row.name?.trim() === name &&
      row.message?.toString().trim() === msg
    );

    res.json({
      reply: found ? "VALID USER ✅" : "INVALID USER ❌"
    });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).send("Server Error");
  }
});

// 🔹 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
