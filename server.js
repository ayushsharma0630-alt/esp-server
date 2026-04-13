const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// 🔹 Supabase
const SUPABASE_URL = "https://kxoztgtalloqqcaboqnb.supabase.co";
const SUPABASE_KEY = "YOUR_SUPABASE_KEY";

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

    // 🔐 STEP 1: DEVICE AUTH
    const deviceRes = await fetch(`${SUPABASE_URL}/rest/v1/devices`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    const devices = await deviceRes.json();

    const validDevice = devices.some(d =>
      d.device_id === device_id && d.token === token
    );

    if (!validDevice) {
      return res.json({ reply: "UNAUTHORIZED DEVICE ❌" });
    }

    console.log("Device verified ✅");

    // 🔐 STEP 2: RSA decrypt AES key
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(key, "base64")
    ).toString("utf-8");

    // 🔐 STEP 3: AES decrypt data
    const decrypted = decryptAES(data, aesKey);
    const [name, msg] = decrypted.split(",").map(v => v.trim());

    console.log("Final:", { name, msg });

    // 🔹 STEP 4: CHECK DATABASE
    const response = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    const db = await response.json();

    const found = db.some(row =>
      row.name === name && row.message == msg
    );

    res.json({
      reply: found ? "VALID USER ✅" : "INVALID USER ❌"
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
