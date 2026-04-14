const express = require("express");

const crypto = require("crypto");

const app = express();
app.use(express.json());

// 🔐 ENV VARIABLES (SET IN RENDER)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

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
  const key = Buffer.from(keyStr);
  const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// 🔥 MAIN ROUTE
app.post("/data", async (req, res) => {
  try {
    const { device_id, token, data, key } = req.body;

    // 🔹 DEVICE AUTH
    const devicesRes = await fetch(`${SUPABASE_URL}/rest/v1/Devices`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    const devices = await devicesRes.json();

    const validDevice = devices.some(d =>
      d.device_id?.trim() === device_id?.trim() &&
      d.token?.trim() === token?.trim()
    );

    if (!validDevice) {
      return res.json({ reply: "UNAUTHORIZED DEVICE ❌" });
    }

    console.log("AUTHORIZED DEVICE ✅");

    // 🔐 DECRYPT UID
    const aesKey = decryptRSA(key);
    const decrypted = decryptAES(data, aesKey);

    const uid = decrypted.trim().toUpperCase();

    console.log("UID:", uid);

    // 🔹 FETCH USERS
    const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    const users = await usersRes.json();

    const found = users.find(u =>
      u.uid?.trim().toUpperCase() === uid
    );

    if (found) {
      return res.json({
        reply: `VALID USER ✅ | Name: ${found.name} | Roll No: ${found.roll_no}`
      });
    } else {
      return res.json({ reply: "INVALID USER ❌" });
    }

  } catch (err) {
    console.log(err);
    res.json({ reply: "SERVER ERROR ❌" });
  }
});

// 🔹 START SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running...");
});
