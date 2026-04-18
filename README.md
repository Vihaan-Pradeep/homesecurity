# StarkHacks2026 — ESP32

Workspace for ESP32 microcontroller work during StarkHacks2026.

## ESP32 Quick Primer

The ESP32 is a low-cost Wi-Fi + Bluetooth capable microcontroller (dual-core Xtensa LX6 @ 240MHz, 520KB SRAM, built-in radios). Common dev boards: **ESP32-DevKitC**, **ESP32-WROOM-32**, **ESP32-S3**, **ESP32-C3**.

### Toolchain

Using **Arduino IDE 2.x** with the ESP32 board package from Espressif.

### Flashing (first time — needs USB)

You need a USB cable at least once to flash firmware that knows how to receive updates wirelessly afterward.

1. Connect ESP32 via USB (Micro-USB or USB-C depending on board)
2. Check port: `ls /dev/ttyUSB* /dev/ttyACM*`
3. If the port doesn't show up, install CP210x or CH340 drivers (depends on the USB-to-serial chip on your board)
4. On Linux you may need to add your user to the `dialout` group: `sudo usermod -aG dialout $USER` (re-login after)
5. Hold **BOOT** button while plugging in if auto-reset doesn't work

### Hello-world sketch (Arduino framework)

```cpp
void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
}
void loop() {
  digitalWrite(LED_BUILTIN, HIGH); delay(500);
  digitalWrite(LED_BUILTIN, LOW);  delay(500);
  Serial.println("hello esp32");
}
```

## Pushing Code Without a Cable

Three main options — all require the **first** flash to be done over USB:

### 1. ArduinoOTA (simplest)
Built-in Arduino library. Device joins Wi-Fi, advertises itself via mDNS, IDE sees it as a network port.

```cpp
#include <WiFi.h>
#include <ArduinoOTA.h>
void setup() {
  WiFi.begin("SSID", "PASSWORD");
  while (WiFi.status() != WL_CONNECTED) delay(500);
  ArduinoOTA.setHostname("esp32-dev");
  ArduinoOTA.setPassword("changeme");
  ArduinoOTA.begin();
}
void loop() { ArduinoOTA.handle(); }
```

After flashing once over USB, the board shows up as a network port in Arduino IDE under `Tools → Port`.

**Limitation:** both dev machine and ESP32 must be on the same LAN.

### 2. HTTP/HTTPS OTA (pull from a server)
Device periodically checks a URL for a new `.bin` and flashes it. Works across networks — good for deployed devices. Uses `Update.h` or `HTTPUpdate.h`. You host the firmware on any web server or S3.

### 3. ESP RainMaker / Blynk / AWS IoT / Firebase
Managed OTA via cloud dashboards. Heavier, but no server to run yourself.

### Other wireless flashing (less common)
- **BLE OTA** — useful when no Wi-Fi available, slower
- **ESP-NOW** — peer-to-peer between ESPs, no router needed

### Hackathon recommendation
Start with **ArduinoOTA** — set it up on your first USB flash and you're free of cables for the rest of the event. Add **HTTP OTA** only if you need remote updates off your LAN.

## Next

Gameplan and project-specific code to be added.
