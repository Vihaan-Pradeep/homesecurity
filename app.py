from flask import Flask, jsonify, request
from flask_socketio import SocketIO
from datetime import datetime
import threading
import serial
import re

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

ALERT_DISTANCE = 100  # cm
SERIAL_PORT = "/dev/ttyUSB0"
BAUD_RATE = 115200

def blank_zone():
    return {"ultrasonic": 0, "ir": False, "motion": False, "qdist": False, "qmot": False}

state = {
    "armed": False,
    "zones": {
        "zone1": blank_zone(),
        "zone2": blank_zone(),
        "zone3": blank_zone(),
    },
    "events": []
}

SENSOR_LINE = re.compile(r"^\s*(?:([0-9]+):)?([0-9]+(?:\.[0-9]+)?)\s*$")

def add_event(msg, level="info"):
    state["events"].insert(0, {
        "msg": msg,
        "time": datetime.now().strftime("%H:%M:%S"),
        "level": level,
    })
    if len(state["events"]) > 50:
        state["events"].pop()

def evaluate_zone_alert(zone_name, prev_dist, dist):
    if not state["armed"]:
        return
    was_alert = 0 < prev_dist < ALERT_DISTANCE
    now_alert = 0 < dist < ALERT_DISTANCE
    if now_alert and not was_alert:
        add_event(f"ALERT — object at {int(dist)}cm in {zone_name}!", "danger")
    elif not now_alert and was_alert:
        add_event(f"{zone_name} cleared ({int(dist)}cm)", "info")

def serial_reader():
    import time
    while True:
        try:
            ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
            print(f"[serial] connected on {SERIAL_PORT}", flush=True)
            while True:
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                if not line:
                    continue
                m = SENSOR_LINE.match(line)
                if not m:
                    continue  # ignore garbled/multi-number lines silently
                zone_idx = int(m.group(1)) if m.group(1) else 1
                zone_key = f"zone{zone_idx}"
                if zone_key not in state["zones"]:
                    continue  # unknown zone
                dist = float(m.group(2))
                if dist < 2 or dist > 400:
                    continue  # out of HC-SR04 physical range — noise
                print(f"[serial] {zone_key} dist={dist}", flush=True)
                prev_dist = state["zones"][zone_key]["ultrasonic"]
                state["zones"][zone_key]["ultrasonic"] = int(dist)
                evaluate_zone_alert(f"Zone {zone_idx}", prev_dist, dist)
                socketio.emit("state_update", state)
        except serial.SerialException as e:
            print(f"[serial] error: {e} — retrying in 2s", flush=True)
            time.sleep(2)
        except Exception as e:
            print(f"[serial] unexpected error: {e} — retrying in 2s", flush=True)
            time.sleep(2)

@app.route("/update", methods=["POST"])
def update():
    data = request.json or {}
    for zone_name, zdata in data.items():
        if zone_name not in state["zones"]:
            continue
        z = state["zones"][zone_name]
        prev_dist = z["ultrasonic"]
        for k in ("ultrasonic", "ir", "motion", "qdist", "qmot"):
            if k in zdata:
                z[k] = zdata[k]
        evaluate_zone_alert(zone_name.replace("zone", "Zone "), prev_dist, z["ultrasonic"])
    socketio.emit("state_update", state)
    return jsonify({"status": "ok", "armed": state["armed"]})

@app.route("/arm", methods=["POST"])
def arm():
    state["armed"] = bool((request.json or {}).get("armed", False))
    add_event("System armed" if state["armed"] else "System disarmed", "info")
    socketio.emit("state_update", state)
    return jsonify({"status": "ok"})

@app.route("/status", methods=["GET"])
def status():
    return jsonify(state)

if __name__ == "__main__":
    import os
    # When Flask debug is on, Werkzeug reloads the app in a child process.
    # Start the serial reader only in the reloaded child, not the parent,
    # so both processes don't fight for the serial port.
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        t = threading.Thread(target=serial_reader, daemon=True)
        t.start()
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
