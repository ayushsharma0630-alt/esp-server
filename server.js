#include <WiFi.h>
#include <HTTPClient.h>
#include "mbedtls/aes.h"

const char* ssid = "Ayush";
const char* password = "Galaxy21";

const char* serverUrl = "https://esp-server-t1t3.onrender.com/data";

// 🔐 AES Encrypt Function
String aesEncrypt(String input) {
  byte key[16] = {
  '1','2','3','4','5','6','7','8',
  '9','0','1','2','3','4','5','6'
};

  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  mbedtls_aes_setkey_enc(&aes, key, 128);

  byte inputBlock[16] = {0};
  byte outputBlock[16] = {0};

  input.getBytes(inputBlock, 16);  // max 16 bytes

  mbedtls_aes_crypt_ecb(&aes, MBEDTLS_AES_ENCRYPT, inputBlock, outputBlock);

  mbedtls_aes_free(&aes);

  // convert to HEX string
  String encrypted = "";
  for (int i = 0; i < 16; i++) {
    if (outputBlock[i] < 16) encrypted += "0";
    encrypted += String(outputBlock[i], HEX);
  }

  return encrypted;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected to WiFi!");
  Serial.print("ESP IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {

  if (WiFi.status() == WL_CONNECTED) {

    // 🔹 Input NAME
    Serial.println("\nEnter Name:");
    while (!Serial.available());
    String name = Serial.readStringUntil('\n');
    name.trim();

    // 🔹 Input ID
    Serial.println("Enter ID:");
    while (!Serial.available());
    String msg = Serial.readStringUntil('\n');
    msg.trim();

    // 🔹 Combine
    String combined = name + "," + msg;

    // 🔐 Encrypt
    String encrypted = aesEncrypt(combined);

    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // 🔹 Send encrypted
    String json = "{\"message\":\"" + encrypted + "\"}";

    int responseCode = http.POST(json);
    String response = http.getString();

    Serial.println("\n--- RESULT ---");
    Serial.print("Original: ");
    Serial.println(combined);

    Serial.print("Encrypted: ");
    Serial.println(encrypted);

    Serial.print("Response Code: ");
    Serial.println(responseCode);

    Serial.print("Server Reply: ");
    Serial.println(response);

    http.end();

    delay(2000);
  }
}
