require("dotenv").config();
const express = require("express");
const crypto = require("crypto");

const app = express();

app.use(express.json());

// ================= ENV =================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// API AES KEY
const API_KEY_HEX = process.env.API_ENCRYPTION_KEY;

if (!API_KEY_HEX) {

  console.error("API_ENCRYPTION_KEY missing ❌");

  process.exit(1);
}

const apiKey = Buffer.from(API_KEY_HEX, "hex");

// =====================================================
// AES-256-GCM DECRYPT
// FORMAT:
// [12-byte IV][16-byte TAG][ciphertext]
// =====================================================
function decryptAES(encryptedBase64) {

  // BASE64 DECODE
  const encryptedBuffer = Buffer.from(
    encryptedBase64,
    "base64"
  );

  // EXTRACT IV
  const iv = encryptedBuffer.subarray(0, 12);

  // EXTRACT TAG
  const authTag = encryptedBuffer.subarray(12, 28);

  // EXTRACT CIPHERTEXT
  const ciphertext = encryptedBuffer.subarray(28);

  // CREATE DECIPHER
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    apiKey,
    iv
  );

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(
    ciphertext,
    null,
    "utf8"
  );

  decrypted += decipher.final("utf8");

  return decrypted;
}

// =====================================================
// MAIN ROUTE
// =====================================================
app.post("/data", async (req, res) => {

  try {

    // ================= GET ENCRYPTED PAYLOAD =================
    const { payload } = req.body;

    if (!payload) {

      return res.json({
        reply: "MISSING PAYLOAD ❌"
      });
    }

    // ================= DECRYPT JSON =================
    let decryptedJson;

    try {

      decryptedJson = decryptAES(payload);

    } catch (e) {

      console.error("AES DECRYPT FAILED:", e.message);

      return res.json({
        reply: "DECRYPT ERROR ❌",
        error: e.message
      });
    }

    console.log("DECRYPTED JSON:");
    console.log(decryptedJson);

    // ================= PARSE JSON =================
    const parsed = JSON.parse(decryptedJson);

    const {
      uid,
      nfcid,
      device_id,
      token
    } = parsed;

    // ================= FIELD CHECK =================
    if (
      !uid ||
      !nfcid ||
      !device_id ||
      !token
    ) {

      return res.json({
        reply: "MISSING FIELDS ❌"
      });
    }

    const cleanUID = uid.trim().toUpperCase();

    const cleanNfcid = nfcid
      .trim()
      .toUpperCase();

    const cleanDevice = device_id
      .trim();

    const cleanToken = token
      .trim();

    // ================= DEVICE AUTH =================
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

    if (
      !Array.isArray(devices) ||
      devices.length === 0
    ) {

      return res.json({
        reply: "UNAUTHORIZED DEVICE ❌"
      });
    }

    console.log("AUTHORIZED DEVICE ✅");

    // ================= USER CHECK =================
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?uid=eq.${encodeURIComponent(cleanUID)}&nfcid=eq.${encodeURIComponent(cleanNfcid)}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const users = await userRes.json();

    // ================= VALID USER =================
    if (
      Array.isArray(users) &&
      users.length > 0
    ) {

      const u = users[0];

      return res.json({

        status: "valid",

        reply:
          `VALID USER ✅ | ` +
          `Name: ${u.name} | ` +
          `Roll No: ${u.roll_no} | ` +
          `${u.Access}`
      });
    }

    // ================= INVALID USER =================
    else {

      return res.json({

        status: "invalid",

        reply: "INVALID USER ❌"
      });
    }

  } catch (err) {

    console.error("SERVER ERROR:", err);

    return res.json({

      reply: "SERVER ERROR ❌",

      error: err.message
    });
  }
});

// =====================================================
// HEALTH
// =====================================================
app.get("/health", (req, res) => {

  res.json({
    status: "ok"
  });
});

// =====================================================
// START SERVER
// =====================================================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

  console.log(
    "Server running on port",
    PORT
  );
});
