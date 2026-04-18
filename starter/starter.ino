// Zone 1 sensor
#define TRIG1_PIN 2
#define ECHO1_PIN 1
// Zone 2 sensor
#define TRIG2_PIN 4
#define ECHO2_PIN 5
// Zone 3 sensor
#define TRIG3_PIN 6
#define ECHO3_PIN 7

void setup()
{
  Serial.begin(115200);
  pinMode(TRIG1_PIN, OUTPUT);
  pinMode(ECHO1_PIN, INPUT);
  pinMode(TRIG2_PIN, OUTPUT);
  pinMode(ECHO2_PIN, INPUT);
  pinMode(TRIG3_PIN, OUTPUT);
  pinMode(ECHO3_PIN, INPUT);
}

float readDistance(int trigPin, int echoPin)
{
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000);
  return duration * 0.034 / 2.0;
}

void reportDistance(int zone, float distance)
{
  if (distance >= 2 && distance <= 400)
  {
    Serial.print(zone);
    Serial.print(":");
    Serial.println(distance);
  }
}

void loop()
{
  reportDistance(1, readDistance(TRIG1_PIN, ECHO1_PIN));
  reportDistance(2, readDistance(TRIG2_PIN, ECHO2_PIN));
  reportDistance(3, readDistance(TRIG3_PIN, ECHO3_PIN));
  delay(50);
}
