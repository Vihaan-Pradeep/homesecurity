from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO
from datetime import datetime
import threading
import serial
import re

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

ALERT_DISTANCE = 100  # cm
SERIAL_PORT = "COM3"  # change to match your port (check Arduino IDE → Tools → Port)
BAUD_RATE = 115200

state = {
    "armed": False,
    "zones": {
        "zone1": {"ultrasonic": 0},
    },
    "events": []
}

def serial_reader():
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"Serial connected on {SERIAL_PORT}")
        while True:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            match = re.search(r"([\d.]+)", line)
            if match:
                dist = float(match.group(1))
                prev_dist = state["zones"]["zone1"]["ultrasonic"]
                state["zones"]["zone1"]["ultrasonic"] = int(dist)
                if state["armed"]:
                    was_alert = 0 < prev_dist < ALERT_DISTANCE
                    now_alert = 0 < dist < ALERT_DISTANCE
                    if now_alert and not was_alert:
                        add_event(f"ALERT — object at {int(dist)}cm in Zone 1!", "danger")
                    elif not now_alert and was_alert:
                        add_event(f"Zone 1 cleared ({int(dist)}cm)", "info")
                socketio.emit("state_update", state)
    except serial.SerialException as e:
        print(f"Serial error: {e} — is the ESP32 plugged in and port correct?")

def add_event(msg, level="info"):
    state["events"].insert(0, {"msg": msg, "time": datetime.now().strftime("%H:%M:%S"), "level": level})
    if len(state["events"]) > 50:
        state["events"].pop()

@app.route("/update", methods=["POST"])
def update():
    data = request.json
    if "zone1" in data:
        dist = data["zone1"].get("ultrasonic", 0)
        prev_dist = state["zones"]["zone1"]["ultrasonic"]
        state["zones"]["zone1"]["ultrasonic"] = dist

        if state["armed"]:
            was_alert = 0 < prev_dist < ALERT_DISTANCE
            now_alert = 0 < dist < ALERT_DISTANCE
            if now_alert and not was_alert:
                add_event(f"ALERT — object at {dist}cm in Zone 1!", "danger")
            elif not now_alert and was_alert:
                add_event(f"Zone 1 cleared ({dist}cm)", "info")

    socketio.emit("state_update", state)
    return jsonify({"status": "ok", "armed": state["armed"]})

@app.route("/arm", methods=["POST"])
def arm():
    state["armed"] = request.json.get("armed", False)
    msg = "System armed" if state["armed"] else "System disarmed"
    add_event(msg, "info")
    socketio.emit("state_update", state)
    return jsonify({"status": "ok"})

@app.route("/status", methods=["GET"])
def status():
    return jsonify(state)

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    t = threading.Thread(target=serial_reader, daemon=True)
    t.start()
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
