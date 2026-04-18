// Minimal ESP32 sanity check: blinks the onboard LED and prints to serial.
// Upload, then open Serial Monitor at 115200 baud.

#ifndef LED_BUILTIN
#define LED_BUILTIN 2  // GPIO2 on most ESP32 DevKit boards
#endif

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  delay(200);
  Serial.println();
  Serial.println("ESP32 starter booted");
}

unsigned long tick = 0;

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);

  Serial.print("tick ");
  Serial.println(tick++);
}
