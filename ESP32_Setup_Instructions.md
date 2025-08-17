# ESP32 E-HAPLOS Setup Instructions

## Hardware Requirements
- ESP32 Development Board (ESP32-WROOM-32 or similar)
- Force-Sensing Resistors (FSR) x2
- EIS (Electrical Impedance Spectroscopy) circuit components
- Connecting wires and breadboard

## Pin Configuration
```
FSR1_PIN = A0    // Force sensor 1
FSR2_PIN = A3    // Force sensor 2  
EIS_REAL_PIN = A6      // EIS real impedance reading
EIS_IMAG_PIN = A7      // EIS imaginary impedance reading
FREQ_CONTROL_PIN = 2   // Frequency control output
```

## ESP32 Firmware Setup

1. **Install Required Libraries** (Arduino IDE):
   - WiFi (built-in)
   - WebSocketsServer by Markus Sattler
   - ArduinoJson by Benoit Blanchon
   - ESP32 BLE Arduino (built-in)

2. **Upload the Firmware**:
   - Open `ESP32_EHAPLOS.ino` in Arduino IDE
   - Update WiFi credentials in the code:
     ```cpp
     const char* ssid = "YOUR_WIFI_SSID";
     const char* password = "YOUR_WIFI_PASSWORD";
     ```
   - Select your ESP32 board and COM port
   - Upload the code

3. **Connection Methods**:
   
   **Method 1: Bluetooth Low Energy (Recommended)**
   - Device Name: "E-HAPLOS"
   - Service UUID: 12345678-1234-1234-1234-123456789abc
   - Characteristic UUID: 87654321-4321-4321-4321-cba987654321
   - Works without WiFi connection
   
   **Method 2: WiFi WebSocket**
   - ESP32 connects to your WiFi network
   - WebSocket server runs on port 81
   - Access via ESP32's IP address

## Testing ESP32 Connection

1. **Power on the ESP32**
2. **Check Serial Monitor** (115200 baud):
   ```
   E-HAPLOS ESP32 Medical Device Starting...
   BLE Advertising Started - Device Name: E-HAPLOS
   WiFi connected! (if WiFi configured)
   IP address: 192.168.x.x
   E-HAPLOS device ready for connection
   ```

3. **Connect from Web Interface**:
   - Open the E-HAPLOS web interface
   - Select "Bluetooth Low Energy" connection method
   - Click "Connect ESP32 via Bluetooth"
   - Select "E-HAPLOS" device when prompted
   - Monitor connection status and sensor data

## Troubleshooting

**Bluetooth Connection Issues**:
- Ensure you're using Chrome, Edge, or Opera browser
- Make sure Bluetooth is enabled on your device
- ESP32 must be advertising (check Serial Monitor)
- Try refreshing the page and reconnecting

**WiFi Connection Issues**:
- Verify WiFi credentials in ESP32 code
- Check if ESP32 is connected to same network as your computer
- Use ESP32's IP address in web interface

**Sensor Data Issues**:
- Check sensor wiring to correct pins
- Verify FSR sensors are properly connected
- EIS circuit must be calibrated for your specific application

## Data Format

The ESP32 sends sensor data in JSON format:

**FSR Data**:
```json
{
  "fsr1": 123.4,
  "fsr2": 567.8
}
```

**EIS Data**:
```json
{
  "freq": 100000,
  "zReal": 1234.56,
  "zImag": 789.12,
  "mag": 1456.78
}
```

**Status Messages**:
- CALIBRATION_STARTED
- CALIBRATION_COMPLETE  
- SWEEP_STARTED
- SWEEP_STOPPED
- PONG (response to PING test)

## Frequency Sweep Configuration

The ESP32 cycles through 8 frequencies for EIS measurements:
- 100,000 Hz
- 125,892 Hz  
- 158,489 Hz
- 199,526 Hz
- 251,188 Hz
- 316,228 Hz
- 398,107 Hz
- 501,187 Hz

Each frequency step takes 200ms, completing a full sweep in 1.6 seconds.