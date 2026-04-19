# StarkHacks2026 — Home Security System

A wired home security system using an Arduino with ultrasonic sensors, a Python backend, and a React frontend.

## Hardware Setup

Connect the Arduino to your computer via USB. The Python backend reads sensor data directly over the serial port.

## Running the Project

Requires two terminals.

### Terminal 1 — Python Backend

```bash
python app.py
```

### Terminal 2 — Frontend

```bash
npm run dev
```

Then open the URL shown in the terminal (usually `http://localhost:5173`).

## How It Works

- The Arduino reads distance data from 3 ultrasonic sensors and sends it over serial at 115200 baud
- `app.py` reads the serial port and serves the data via a local API
- The frontend polls the backend and displays live sensor readings
