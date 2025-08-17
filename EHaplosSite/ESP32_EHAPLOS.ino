/*
 * E-HAPLOS PROJECT - ESP32 Code
 * Medical Device with FSR and EIS sensors
 * 
 * Real ESP32 implementation supporting:
 * - Bluetooth Low Energy (BLE) communication
 * - WiFi WebSocket communication  
 * - FSR and EIS sensor interfacing
 * - Frequency sweep generation
 * 
 * Compatible with the E-HAPLOS web interface
 */

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// WiFi credentials - Update these for your network
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// WebSocket server on port 81
WebSocketsServer webSocket = WebSocketsServer(81);

// BLE Configuration
#define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID "87654321-4321-4321-4321-cba987654321"
#define DEVICE_NAME         "E-HAPLOS"

BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool deviceConnected = false;
bool bleEnabled = true;

// FSR sensor pins
const int FSR1_PIN = A0;  // GPIO36
const int FSR2_PIN = A3;  // GPIO39

// EIS measurement pins (example - adjust for your actual EIS circuit)
const int EIS_REAL_PIN = A6;     // GPIO34
const int EIS_IMAG_PIN = A7;     // GPIO35
const int FREQ_CONTROL_PIN = 25; // DAC pin for frequency control

// Frequency sweep configuration
const float frequencies[] = {100000.0, 125892.0, 158489.0, 199526.0, 251188.0, 316228.0, 398107.0, 501187.0};
const int numFrequencies = sizeof(frequencies) / sizeof(frequencies[0]);
int currentFreqIndex = 0;

// Timing variables
unsigned long lastSensorRead = 0;
unsigned long lastFreqSweep = 0;
const unsigned long SENSOR_INTERVAL = 100;  // Read sensors every 100ms
const unsigned long FREQ_SWEEP_INTERVAL = 200; // Change frequency every 200ms

// Device state
bool isCalibrating = false;
bool isConnected = false;
bool sweepActive = false;
unsigned long calibrationStart = 0;
const unsigned long CALIBRATION_TIME = 5000; // 5 seconds

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("BLE Client Connected");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("BLE Client Disconnected");
      pServer->getAdvertising()->start(); // Restart advertising
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string rxValue = pCharacteristic->getValue();
      
      if (rxValue.length() > 0) {
        String command = String(rxValue.c_str());
        command.trim();
        Serial.println("BLE Command: " + command);
        handleCommand(command);
      }
    }
};

void setup() {
  Serial.begin(115200);
  Serial.println("E-HAPLOS ESP32 Medical Device Starting...");
  
  // Initialize sensor pins
  pinMode(FSR1_PIN, INPUT);
  pinMode(FSR2_PIN, INPUT);
  pinMode(EIS_REAL_PIN, INPUT);
  pinMode(EIS_IMAG_PIN, INPUT);
  pinMode(FREQ_CONTROL_PIN, OUTPUT);
  
  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ |
                      BLECharacteristic::PROPERTY_WRITE |
                      BLECharacteristic::PROPERTY_NOTIFY
                    );

  pCharacteristic->setCallbacks(new MyCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());

  pService->start();
  
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);
  BLEDevice::startAdvertising();
  
  Serial.println("BLE Advertising Started - Device Name: " + String(DEVICE_NAME));
  Serial.println("BLE Service UUID: " + String(SERVICE_UUID));
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    // Start WebSocket server
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
    
    Serial.println("WebSocket server started on port 81");
  } else {
    Serial.println();
    Serial.println("WiFi connection failed - BLE only mode");
  }
  
  Serial.println("E-HAPLOS device ready for connection");
  Serial.println("Available connection methods:");
  Serial.println("1. Bluetooth Low Energy (Always available)");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("2. WiFi WebSocket at " + WiFi.localIP().toString() + ":81");
  }
}

void loop() {
  webSocket.loop();
  
  unsigned long currentTime = millis();
  
  // Handle calibration timeout
  if (isCalibrating && (currentTime - calibrationStart) >= CALIBRATION_TIME) {
    isCalibrating = false;
    webSocket.broadcastTXT("CALIBRATION_COMPLETE");
    Serial.println("Calibration complete");
  }
  
  // Read sensors at regular intervals
  if (currentTime - lastSensorRead >= SENSOR_INTERVAL) {
    if (isConnected && !isCalibrating) {
      readAndSendSensorData();
    }
    lastSensorRead = currentTime;
  }
  
  // Handle frequency sweep
  if (sweepActive && (currentTime - lastFreqSweep >= FREQ_SWEEP_INTERVAL)) {
    performFrequencyStep();
    lastFreqSweep = currentTime;
  }
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      isConnected = false;
      sweepActive = false;
      break;
      
    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[%u] Connected from %d.%d.%d.%d url: %s\n", num, ip[0], ip[1], ip[2], ip[3], payload);
      isConnected = true;
      break;
    }
    
    case WStype_TEXT:
      Serial.printf("[%u] Received: %s\n", num, payload);
      handleCommand((char*)payload);
      break;
      
    default:
      break;
  }
}

void handleCommand(String command) {
  command.toUpperCase();
  command.trim();
  
  Serial.println("Processing command: " + command);
  
  if (command == "CALIBRATE") {
    startCalibration();
    sendMessage("CALIBRATION_STARTED");
  } else if (command == "START_SWEEP") {
    startFrequencySweep();
    sendMessage("SWEEP_STARTED");
  } else if (command == "STOP_SWEEP") {
    stopFrequencySweep();
    sendMessage("SWEEP_STOPPED");
  } else if (command == "STATUS") {
    sendStatus();
  } else if (command == "PING") {
    sendMessage("PONG");
  } else {
    sendMessage("ERROR: Unknown command: " + command);
  }
}

void sendMessage(String message) {
  // Send via BLE if connected
  if (deviceConnected && bleEnabled) {
    pCharacteristic->setValue(message.c_str());
    pCharacteristic->notify();
  }
  
  // Send via WebSocket if WiFi connected  
  if (WiFi.status() == WL_CONNECTED) {
    webSocket.broadcastTXT(message);
  }
  
  // Always send via Serial for debugging
  Serial.println("Sent: " + message);
}

void sendStatus() {
  DynamicJsonDocument statusDoc(300);
  statusDoc["device"] = "E-HAPLOS";
  statusDoc["firmware"] = "1.0.0";
  statusDoc["ble_connected"] = deviceConnected;
  statusDoc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
  statusDoc["calibrating"] = isCalibrating;
  statusDoc["sweep_active"] = sweepActive;
  
  String statusJson;
  serializeJson(statusDoc, statusJson);
  sendMessage(statusJson);
}

void startCalibration() {
  isCalibrating = true;
  calibrationStart = millis();
  Serial.println("Starting calibration...");
  sendMessage("CALIBRATION_STARTED");
}

void startFrequencySweep() {
  sweepActive = true;
  currentFreqIndex = 0;
  Serial.println("Starting frequency sweep...");
  sendMessage("SWEEP_STARTED");
}

void stopFrequencySweep() {
  sweepActive = false;
  Serial.println("Frequency sweep stopped");
}

void readAndSendSensorData() {
  // Read FSR sensors
  float fsr1_raw = analogRead(FSR1_PIN);
  float fsr2_raw = analogRead(FSR2_PIN);
  
  // Convert FSR readings to grams (calibration needed for your specific sensors)
  float fsr1_grams = mapFSRToGrams(fsr1_raw);
  float fsr2_grams = mapFSRToGrams(fsr2_raw);
  
  // Create JSON object for FSR data
  DynamicJsonDocument fsrDoc(200);
  fsrDoc["fsr1"] = fsr1_grams;
  fsrDoc["fsr2"] = fsr2_grams;
  
  String fsrJson;
  serializeJson(fsrDoc, fsrJson);
  
  // Send via WebSocket if WiFi connected
  if (WiFi.status() == WL_CONNECTED) {
    webSocket.broadcastTXT(fsrJson);
  }
  
  // Send via BLE if connected
  if (deviceConnected && bleEnabled) {
    pCharacteristic->setValue(fsrJson.c_str());
    pCharacteristic->notify();
  }
  
  // Send via Serial for debugging
  Serial.println("FSR Data: " + fsrJson);
}

void performFrequencyStep() {
  if (currentFreqIndex >= numFrequencies) {
    currentFreqIndex = 0; // Reset sweep
  }
  
  float currentFreq = frequencies[currentFreqIndex];
  
  // Set frequency (this depends on your EIS circuit implementation)
  setEISFrequency(currentFreq);
  
  // Wait for settling time
  delay(10);
  
  // Read EIS values
  float zReal = readEISReal();
  float zImag = readEISImaginary();
  float magnitude = sqrt(zReal * zReal + zImag * zImag);
  
  // Create JSON object for EIS data
  DynamicJsonDocument eisDoc(300);
  eisDoc["freq"] = currentFreq;
  eisDoc["zReal"] = zReal;
  eisDoc["zImag"] = zImag;
  eisDoc["mag"] = magnitude;
  
  String eisJson;
  serializeJson(eisDoc, eisJson);
  
  // Send via WebSocket if WiFi connected
  if (WiFi.status() == WL_CONNECTED) {
    webSocket.broadcastTXT(eisJson);
  }
  
  // Send via BLE if connected
  if (deviceConnected && bleEnabled) {
    pCharacteristic->setValue(eisJson.c_str());
    pCharacteristic->notify();
  }
  
  // Send via Serial for debugging
  Serial.println("EIS Data: " + eisJson);
  
  currentFreqIndex++;
}

float mapFSRToGrams(float rawValue) {
  // Convert ADC reading to grams
  // This is a basic conversion - calibrate for your specific FSR sensors
  // ADC range: 0-4095 for ESP32
  // Example mapping: 0-4095 -> 0-100 grams
  
  if (rawValue < 100) return 0; // Noise threshold
  
  float voltage = rawValue * (3.3 / 4095.0);
  float resistance = (3.3 - voltage) / voltage * 10000; // Assuming 10k pull-down
  
  // FSR resistance to force conversion (depends on your FSR model)
  // This is an example - adjust for your specific FSR
  float grams = 0;
  if (resistance < 30000) {
    grams = map(resistance, 300, 30000, 100, 0);
  }
  
  return max(0.0f, grams);
}

void setEISFrequency(float frequency) {
  // Generate the required frequency for EIS measurement
  // This implementation depends on your EIS circuit
  
  // Example using DAC for simple frequency control
  // You may need a more sophisticated frequency generator
  float dacValue = map(frequency, 100000, 501187, 0, 255);
  dacWrite(FREQ_CONTROL_PIN, (int)dacValue);
}

float readEISReal() {
  // Read the real component of impedance
  // This depends on your EIS measurement circuit
  
  float rawValue = analogRead(EIS_REAL_PIN);
  float voltage = rawValue * (3.3 / 4095.0);
  
  // Convert voltage to impedance real component
  // This conversion depends on your EIS circuit design
  float zReal = voltage * 1000 + 1000; // Example: 1000-4000 ohms range
  
  return zReal;
}

float readEISImaginary() {
  // Read the imaginary component of impedance
  // This depends on your EIS measurement circuit
  
  float rawValue = analogRead(EIS_IMAG_PIN);
  float voltage = rawValue * (3.3 / 4095.0);
  
  // Convert voltage to impedance imaginary component
  // This conversion depends on your EIS circuit design
  float zImag = voltage * 500 + 200; // Example: 200-2200 ohms range
  
  return zImag;
}

// Alternative functions for Serial communication (if WebSocket fails)
void setupSerial() {
  Serial.begin(115200);
  Serial.println("E-HAPLOS ESP32 Device Ready");
  Serial.println("Send commands: CALIBRATE, START_SWEEP, STOP_SWEEP");
}

void handleSerialCommands() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    if (command == "CALIBRATE") {
      startCalibration();
    } else if (command == "START_SWEEP") {
      startFrequencySweep();
    } else if (command == "STOP_SWEEP") {
      stopFrequencySweep();
    }
  }
}

void sendSerialData() {
  // Send FSR data
  DynamicJsonDocument fsrDoc(200);
  fsrDoc["fsr1"] = mapFSRToGrams(analogRead(FSR1_PIN));
  fsrDoc["fsr2"] = mapFSRToGrams(analogRead(FSR2_PIN));
  
  String fsrJson;
  serializeJson(fsrDoc, fsrJson);
  Serial.println(fsrJson);
  
  // Send EIS data if sweep is active
  if (sweepActive && currentFreqIndex < numFrequencies) {
    float currentFreq = frequencies[currentFreqIndex];
    setEISFrequency(currentFreq);
    delay(10);
    
    DynamicJsonDocument eisDoc(300);
    eisDoc["freq"] = currentFreq;
    eisDoc["zReal"] = readEISReal();
    eisDoc["zImag"] = readEISImaginary();
    eisDoc["mag"] = sqrt(pow(eisDoc["zReal"], 2) + pow(eisDoc["zImag"], 2));
    
    String eisJson;
    serializeJson(eisDoc, eisJson);
    Serial.println(eisJson);
  }
}