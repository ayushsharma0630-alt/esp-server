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
  res.send("Secure Server Running 🔐");
});

// 🔹 MAIN ROUTE
app.post("/data", async (req, res) => {
  try {
    const { device_id, token, data, key } = req.body;

    // 🔥 STEP 1: FETCH DEVICES
    const deviceRes = await fetch(`${SUPABASE_URL}/rest/v1/devices`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    const devices = await deviceRes.json();
    console.log("Devices DB:", devices);

    // 🔥 FIX: ensure array
    if (!Array.isArray(devices)) {
      return res.json({ reply: "DEVICE DB ERROR ❌" });
    }

    // 🔥 STEP 2: VERIFY DEVICE
    const validDevice = devices.some(d =>
      d.device_id === device_id && d.token === token
    );

    if (!validDevice) {
      return res.json({ reply: "UNAUTHORIZED DEVICE ❌" });
    }

    console.log("Device verified ✅");

    // 🔐 STEP 3: RSA decrypt AES key
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(key, "base64")
    ).toString("utf-8");

    // 🔐 STEP 4: AES decrypt data
    const decrypted = decryptAES(data, aesKey);
    const [name, msg] = decrypted.split(",").map(v => v.trim());

    console.log("Final:", { name, msg });

    // 🔹 STEP 5: FETCH USERS
    const response = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    const db = await response.json();

    if (!Array.isArray(db)) {
      return res.json({ reply: "DB ERROR ❌" });
    }

    // 🔹 STEP 6: MATCH
    const found = db.some(row =>
      row.name === name && row.message == msg
    );

    res.json({
      reply: found ? "VALID USER ✅" : "INVALID USER ❌"
    });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).send("Server Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
