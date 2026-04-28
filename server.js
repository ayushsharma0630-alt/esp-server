const express = require("express");
const crypto = require("crypto");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// 🔐 ENV (ONLY ONCE)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!PRIVATE_KEY) {
  console.error("PRIVATE_KEY missing ❌");
  process.exit(1);
}

// 🔐 RSA DECRYPT
function decryptRSA(encryptedKey) {
  const buffer = Buffer.from(encryptedKey, "base64");

  return crypto.privateDecrypt(
    {
      key: PRIVATE_KEY,
      padding: crypto.constants.RSA_PKCS1_PADDING
    },
    buffer
  ).toString();
}

// 🔐 AES DECRYPT
function decryptAES(encryptedHex, keyStr) {
  const key = Buffer.from(keyStr.substring(0, 16), "utf8");

  const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);
  decipher.setAutoPadding(true);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// 🔥 MAIN ROUTE
app.post("/data", async (req, res) => {
  try {
    const { device_id, token, data, key } = req.body;

    if (!device_id || !token || !data || !key) {
      return res.json({ reply: "MISSING FIELDS ❌" });
    }

    const cleanDevice = device_id.trim();
    const cleanToken = token.trim();

    // 🔹 DEVICE AUTH
    const devRes = await fetch(
      `${SUPABASE_URL}/rest/v1/Devices?device_id=eq.${encodeURIComponent(cleanDevice)}&token=eq.${encodeURIComponent(cleanToken)}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const devices = await devRes.json();

    if (!Array.isArray(devices) || devices.length === 0) {
      return res.json({ reply: "UNAUTHORIZED DEVICE ❌" });
    }

    console.log("AUTHORIZED DEVICE ✅");

    // 🔐 DECRYPT
    let aesKey, decrypted;

    try {
      aesKey = decryptRSA(key);
      decrypted = decryptAES(data, aesKey);
    } catch (e) {
      console.error("Decrypt failed:", e.message);
      return res.json({ reply: "DECRYPT ERROR ❌", error: e.message });
    }

    const uid = decrypted.replace(/\0/g, "").trim().toUpperCase();

    console.log("UID:", uid);

    // 🔹 USER CHECK
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?uid=eq.${encodeURIComponent(uid)}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const users = await userRes.json();

    if (Array.isArray(users) && users.length > 0) {
      const u = users[0];

      return res.json({
        reply: `VALID USER ✅ | Name: ${u.name} | Roll No: ${u.roll_no}`
      });
    } else {
      return res.json({ reply: "INVALID USER ❌" });
    }

  } catch (err) {
    console.error("SERVER ERROR:", err);

    res.json({
      reply: "SERVER ERROR ❌",
      error: err.message
    });
  }
});

// 🔹 HEALTH
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 🔹 START
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
