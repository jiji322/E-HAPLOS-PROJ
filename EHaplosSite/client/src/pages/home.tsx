import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bluetooth, User, Signal, Weight, Zap, TrendingUp, Stethoscope, Link } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface SensorData {
  fsr1: string;
  fsr2: string;
  total: string;
  zReal: string;
  zImaginary: string;
  magnitude: string;
}

interface ChartDataPoint {
  frequency: number;
  magnitude: number;
}

type StatusType = "inactive" | "success" | "error" | "warning";

export default function Home() {
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState<StatusType>("inactive");
  const [fsrStatus, setFsrStatus] = useState<StatusType>("inactive");
  const [eisStatus, setEisStatus] = useState<StatusType>("inactive");
  const [sensorData, setSensorData] = useState<SensorData>({
    fsr1: "--",
    fsr2: "--", 
    total: "--",
    zReal: "--",
    zImaginary: "--",
    magnitude: "--"
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [diagnosis, setDiagnosis] = useState("Device not connected. Please connect E-HAPLOS device to begin analysis.");
  
  const frequencies = [100000.0, 125892.0, 158489.0, 199526.0, 251188.0, 316228.0, 398107.0, 501187.0];

  const generateEISData = useCallback((frequency: number) => {
    // Generate impedance values up to 5000 ohms
    const baseImpedance = 2000 + Math.random() * 3000; // Range: 2000-5000 ohms
    const frequencyFactor = Math.log10(frequency) / 6; // Adjusted for new frequency range
    
    const zReal = baseImpedance * (1 - frequencyFactor * 0.5) + (Math.random() - 0.5) * 200;
    const zImaginary = baseImpedance * frequencyFactor * 0.6 + (Math.random() - 0.5) * 150;
    const magnitude = Math.sqrt(zReal * zReal + zImaginary * zImaginary);

    return {
      zReal: Math.max(0, zReal).toFixed(2),
      zImaginary: Math.max(0, zImaginary).toFixed(2),
      magnitude: magnitude.toFixed(2)
    };
  }, []);

  const generateFSRData = useCallback(() => {
    const fsr1 = Math.random() * 50 + 10;
    const fsr2 = Math.random() * 50 + 10;
    const total = (fsr1 + fsr2) / 1000;

    return {
      fsr1: fsr1.toFixed(1),
      fsr2: fsr2.toFixed(1),
      total: total.toFixed(3)
    };
  }, []);

  const updateDiagnosis = useCallback((eisMagnitude: string, fsrTotal: string) => {
    if (!isConnected) {
      setDiagnosis("Device not connected. Please connect E-HAPLOS device to begin analysis.");
    } else if (isCalibrating) {
      setDiagnosis("EIS is calibrating in the air...");
    } else if (parseFloat(fsrTotal) < 0.020) {
      setDiagnosis("Insufficient contact pressure. Please ensure proper sensor contact.");
    } else {
      const magnitude = parseFloat(eisMagnitude);
      if (magnitude < 2500) {
        setDiagnosis("Normal soft tissue detected. Impedance values within expected range.");
      } else if (magnitude > 4000) {
        setDiagnosis("Possible dense mass detected. Higher impedance values observed. Further evaluation recommended.");
      } else {
        setDiagnosis("Tissue analysis in progress. Impedance values being evaluated.");
      }
    }
  }, [isConnected, isCalibrating]);

  const performFrequencySweep = useCallback(() => {
    if (!isConnected || isCalibrating) return null;

    let frequencyIndex = 0;
    let sweepCount = 0;
    
    const sweepInterval = setInterval(() => {
      const currentFreq = frequencies[frequencyIndex];
      const eisData = generateEISData(currentFreq);
      const fsrData = generateFSRData();

      // Update sensor data display with current frequency
      setSensorData({
        fsr1: fsrData.fsr1,
        fsr2: fsrData.fsr2,
        total: fsrData.total,
        zReal: eisData.zReal,
        zImaginary: eisData.zImaginary,
        magnitude: eisData.magnitude
      });

      // Add new data point to chart
      setChartData(prev => {
        const newPoint = {
          frequency: currentFreq,
          magnitude: parseFloat(eisData.magnitude)
        };
        
        // If starting new sweep, clear previous data
        if (frequencyIndex === 0 && sweepCount > 0) {
          return [newPoint];
        }
        
        return [...prev, newPoint];
      });

      // Update sensor status based on pressure
      const totalPressureKg = parseFloat(fsrData.total);
      if (totalPressureKg >= 0.020) {
        setFsrStatus("success");
        setEisStatus("success");
      } else {
        setFsrStatus("error");
        setEisStatus("error");
      }

      // Update diagnosis
      updateDiagnosis(eisData.magnitude, fsrData.total);
      
      frequencyIndex++;
      
      // Reset for continuous sweeping
      if (frequencyIndex >= frequencies.length) {
        frequencyIndex = 0;
        sweepCount++;
      }
    }, 200); // 200ms between frequency steps

    return sweepInterval;
  }, [isConnected, isCalibrating, frequencies, generateEISData, generateFSRData, updateDiagnosis]);

  useEffect(() => {
    let sweepInterval: NodeJS.Timeout | null = null;
    
    if (isConnected && !isCalibrating) {
      sweepInterval = performFrequencySweep();
    }
    
    return () => {
      if (sweepInterval) {
        clearInterval(sweepInterval);
      }
    };
  }, [isConnected, isCalibrating]);

  // Real ESP32 Bluetooth connection functionality
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null);
  const [bluetoothCharacteristic, setBluetoothCharacteristic] = useState<any>(null);
  const [connectionMethod, setConnectionMethod] = useState<'bluetooth' | 'websocket'>('bluetooth');
  const [espIP, setEspIP] = useState('192.168.1.100');

  const connectBluetooth = async () => {
    try {
      setIsConnecting(true);
      console.log('Starting ESP32 Bluetooth connection...');
      
      // Check if Web Bluetooth is supported
      if (!(navigator as any).bluetooth) {
        throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.');
      }

      // Request ESP32 Bluetooth device - more flexible search
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { name: 'E-HAPLOS' },
          { namePrefix: 'ESP32' },
          { namePrefix: 'esp32' }
        ],
        optionalServices: [
          '12345678-1234-1234-1234-123456789abc',
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '0000180a-0000-1000-8000-00805f9b34fb'  // Device Information
        ]
      });

      console.log('ESP32 device selected:', device.name);
      setBluetoothDevice(device);
      setBluetoothStatus("warning");

      // Add disconnect event listener
      device.addEventListener('gattserverdisconnected', () => {
        console.log('ESP32 disconnected');
        setIsConnected(false);
        setBluetoothStatus("inactive");
        setFsrStatus("inactive");
        setEisStatus("inactive");
      });

      // Connect to GATT server
      console.log('Connecting to GATT server...');
      const server = await device.gatt?.connect();
      if (!server) throw new Error('Failed to connect to GATT server');

      console.log('GATT server connected, getting service...');
      
      // Get primary service
      const service = await server.getPrimaryService('12345678-1234-1234-1234-123456789abc');
      console.log('Service found, getting characteristic...');
      
      // Get characteristic
      const characteristic = await service.getCharacteristic('87654321-4321-4321-4321-cba987654321');
      console.log('Characteristic found, setting up notifications...');
      
      setBluetoothCharacteristic(characteristic);

      // Setup notifications for real-time data
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleBluetoothData);
      console.log('Notifications enabled');

      setIsConnected(true);
      setIsCalibrating(true);
      setIsConnecting(false);
      setBluetoothStatus("success");
      setEisStatus("warning");

      // Send calibration command to ESP32
      console.log('Sending calibration command...');
      const calibrateCmd = new TextEncoder().encode('CALIBRATE');
      await characteristic.writeValue(calibrateCmd);

      // Start actual data collection after calibration
      setTimeout(async () => {
        setIsCalibrating(false);
        setEisStatus("success");
        console.log('Starting frequency sweep...');
        const sweepCmd = new TextEncoder().encode('START_SWEEP');
        await characteristic.writeValue(sweepCmd);
      }, 5000);

    } catch (error: any) {
      console.error('ESP32 Bluetooth connection failed:', error);
      setIsConnecting(false);
      setBluetoothStatus("error");
      
      let errorMessage = 'ESP32 Bluetooth connection failed: ' + (error.message || 'Unknown error') + '\n\n';
      
      if (error.message?.includes('not supported')) {
        errorMessage += 'Web Bluetooth is not supported. Please use Chrome, Edge, or Opera browser.';
      } else if (error.message?.includes('User cancelled')) {
        errorMessage += 'Connection cancelled. Please try again and select your ESP32 device.';
      } else if (error.message?.includes('GATT server')) {
        errorMessage += 'Cannot connect to ESP32. Make sure:\n- ESP32 is powered on\n- ESP32 firmware is running\n- Device is in pairing mode';
      } else if (error.message?.includes('Service not found')) {
        errorMessage += 'ESP32 service not found. Make sure the ESP32 is running the E-HAPLOS firmware.';
      } else {
        errorMessage += 'Make sure:\n- ESP32 is powered on and running E-HAPLOS firmware\n- Bluetooth is enabled on your device\n- You are using a compatible browser (Chrome/Edge/Opera)';
      }
      
      alert(errorMessage);
    }
  };

  const connectWebSocket = async () => {
    try {
      setIsConnecting(true);
      
      const ws = new WebSocket(`ws://${espIP}:81/ws`);
      
      ws.onopen = () => {
        setIsConnected(true);
        setIsCalibrating(true);
        setIsConnecting(false);
        setBluetoothStatus("success");
        setEisStatus("warning");

        // Send calibration command
        ws.send('CALIBRATE');

        setTimeout(() => {
          setIsCalibrating(false);
          setEisStatus("success");
          ws.send('START_SWEEP');
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealSensorData(data);
        } catch (e) {
          console.log('Received:', event.data);
        }
      };

      ws.onerror = () => {
        setIsConnecting(false);
        setBluetoothStatus("error");
        alert(`WebSocket connection failed to ${espIP}:81\n\nCheck ESP32 IP address and WiFi connection.`);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setBluetoothStatus("inactive");
      };

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setIsConnecting(false);
      setBluetoothStatus("error");
    }
  };

  const handleBluetoothData = (event: Event) => {
    const target = event.target as any;
    const value = target.value;
    
    if (value) {
      const decoder = new TextDecoder();
      const dataString = decoder.decode(value);
      console.log('Raw ESP32 data:', dataString);
      
      try {
        // Handle JSON data from ESP32
        const data = JSON.parse(dataString);
        console.log('Parsed ESP32 data:', data);
        handleRealSensorData(data);
      } catch (e) {
        // Handle non-JSON responses (status messages, etc.)
        console.log('ESP32 message:', dataString);
        
        // Handle specific ESP32 status messages
        if (dataString.includes('CALIBRATION_COMPLETE')) {
          setIsCalibrating(false);
          setEisStatus("success");
          console.log('ESP32 calibration complete');
        } else if (dataString.includes('SWEEP_STARTED')) {
          console.log('ESP32 frequency sweep started');
        } else if (dataString.includes('ERROR')) {
          setBluetoothStatus("error");
          console.error('ESP32 error:', dataString);
        }
      }
    }
  };

  const handleRealSensorData = (data: any) => {
    console.log('Processing ESP32 sensor data:', data);
    
    // Process FSR data from ESP32
    if (data.fsr1 !== undefined && data.fsr2 !== undefined) {
      const fsrData = {
        fsr1: data.fsr1.toFixed(1),
        fsr2: data.fsr2.toFixed(1),
        total: ((data.fsr1 + data.fsr2) / 1000).toFixed(3)
      };
      
      setSensorData(prev => ({
        ...prev,
        fsr1: fsrData.fsr1,
        fsr2: fsrData.fsr2,
        total: fsrData.total
      }));

      const totalPressureKg = parseFloat(fsrData.total);
      setFsrStatus(totalPressureKg >= 0.020 ? "success" : "error");
      console.log('FSR data updated:', fsrData);
    }

    // Process EIS data from ESP32
    if (data.freq !== undefined && data.mag !== undefined) {
      const eisData = {
        zReal: data.zReal?.toFixed(2) || "--",
        zImaginary: data.zImag?.toFixed(2) || "--", 
        magnitude: data.mag.toFixed(2)
      };

      setSensorData(prev => ({
        ...prev,
        zReal: eisData.zReal,
        zImaginary: eisData.zImaginary,
        magnitude: eisData.magnitude
      }));

      // Update chart with real frequency sweep data
      setChartData(prev => {
        const newPoint = {
          frequency: data.freq,
          magnitude: data.mag
        };
        
        // Keep only the latest complete sweep (all 8 frequencies)
        const filtered = prev.filter(p => p.frequency !== data.freq);
        const updated = [...filtered, newPoint].sort((a, b) => a.frequency - b.frequency);
        
        // Limit to prevent memory buildup
        return updated.slice(-20);
      });

      setEisStatus("success");
      updateDiagnosis(eisData.magnitude, sensorData.total);
      console.log('EIS data updated:', eisData);
    }

    // Handle raw sensor readings for debugging
    if (data.raw_fsr1 !== undefined || data.raw_eis !== undefined) {
      console.log('Raw ESP32 sensor readings:', {
        raw_fsr1: data.raw_fsr1,
        raw_fsr2: data.raw_fsr2,
        raw_eis_real: data.raw_eis_real,
        raw_eis_imag: data.raw_eis_imag
      });
    }
  };

  const testBluetoothConnection = async () => {
    if (bluetoothCharacteristic) {
      try {
        const testCmd = new TextEncoder().encode('PING');
        await bluetoothCharacteristic.writeValue(testCmd);
        console.log('ESP32 connection test sent');
      } catch (error) {
        console.error('ESP32 test failed:', error);
      }
    }
  };

  const handleConnection = async () => {
    if (!isConnected) {
      if (connectionMethod === 'bluetooth') {
        await connectBluetooth();
      } else {
        await connectWebSocket();
      }
    } else {
      // Disconnect
      if (bluetoothDevice) {
        try {
          console.log('Disconnecting from ESP32...');
          bluetoothDevice.gatt?.disconnect();
          setBluetoothDevice(null);
          setBluetoothCharacteristic(null);
        } catch (error) {
          console.error('Disconnect error:', error);
        }
      }
      
      setIsConnected(false);
      setIsCalibrating(false);
      setBluetoothStatus("inactive");
      setFsrStatus("inactive");
      setEisStatus("inactive");
      
      setSensorData({
        fsr1: "--",
        fsr2: "--",
        total: "--",
        zReal: "--",
        zImaginary: "--",
        magnitude: "--"
      });
      
      setChartData([]);
      updateDiagnosis("0", "0");
    }
  };

  const getButtonText = () => {
    if (isConnecting) return "Connecting...";
    if (isConnected) return "Disconnect Device";
    return "Connect E-HAPLOS Device";
  };

  const StatusIndicator = ({ status, label }: { status: StatusType; label: string }) => (
    <div className="flex items-center gap-3">
      <div className={`status-indicator status-${status}`} />
      <span className="text-medical-text font-medium">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "var(--medical-dark)" }}>
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            E-HAPLOS <span className="gradient-text">PROJECT</span>
          </h1>
          <p className="text-medical-text-dim text-lg mb-1">Gawa ng Filipino Para sa Filipino</p>
          <p className="text-medical-text text-sm">By Ralph Jirell</p>
        </div>

        {/* Medical Disclaimer */}
        <div className="disclaimer-banner p-4 mb-8 text-center rounded-lg">
          <div className="flex items-center justify-center gap-3">
            <AlertTriangle className="text-white text-xl" />
            <span className="text-white font-medium">
              MEDICAL DEVICE - FOR RESEARCH PURPOSES ONLY - NOT FOR CLINICAL DIAGNOSIS
            </span>
            <AlertTriangle className="text-white text-xl" />
          </div>
        </div>

        {/* Patient Information */}
        <Card className="medical-card mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <User className="text-medical-accent" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="block text-medical-text mb-2 font-medium">Patient Name</Label>
                <Input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="medical-input"
                  placeholder="Enter patient name"
                  data-testid="input-patient-name"
                />
              </div>
              <div>
                <Label className="block text-medical-text mb-2 font-medium">Patient Age</Label>
                <Input
                  type="number"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  className="medical-input"
                  placeholder="Enter age"
                  min="1"
                  max="120"
                  data-testid="input-patient-age"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Connection */}
        <Card className="medical-card mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <Link className="text-medical-accent" />
              E-HAPLOS Device Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="connectionMethod" className="text-sm font-medium text-gray-300 mb-2 block">
                  Connection Method
                </Label>
                <select
                  id="connectionMethod"
                  value={connectionMethod}
                  onChange={(e) => setConnectionMethod(e.target.value as 'bluetooth' | 'websocket')}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white backdrop-blur-xl"
                  disabled={isConnected}
                >
                  <option value="bluetooth">Bluetooth Low Energy</option>
                  <option value="websocket">WiFi (WebSocket)</option>
                </select>
              </div>
              
              {connectionMethod === 'websocket' && (
                <div>
                  <Label htmlFor="espIP" className="text-sm font-medium text-gray-300 mb-2 block">
                    ESP32 IP Address
                  </Label>
                  <Input
                    id="espIP"
                    type="text"
                    value={espIP}
                    onChange={(e) => setEspIP(e.target.value)}
                    placeholder="192.168.1.100"
                    className="bg-white/5 border-white/10 text-white backdrop-blur-xl"
                    disabled={isConnected}
                  />
                </div>
              )}
            </div>
            
            <div className="text-center space-y-4">
              <Button 
                onClick={handleConnection}
                disabled={isConnecting}
                className={`medical-button ${isConnecting ? 'pulse' : ''}`}
                data-testid="button-connect-device"
              >
                <span className="text-2xl mr-3">
                  {connectionMethod === 'bluetooth' ? '📱' : '📶'}
                </span>
                <span>
                  {isConnecting ? 'Connecting to ESP32...' : 
                   isConnected ? 'Disconnect ESP32 Device' : 
                   `Connect ESP32 via ${connectionMethod === 'bluetooth' ? 'Bluetooth' : 'WiFi'}`}
                </span>
              </Button>

              {isConnected && connectionMethod === 'bluetooth' && (
                <Button 
                  onClick={testBluetoothConnection}
                  variant="outline"
                  className="ml-4"
                >
                  <span className="mr-2">🔍</span>
                  Test ESP32 Connection
                </Button>
              )}
              
              {connectionMethod === 'bluetooth' && !isConnected && (
                <div className="text-sm text-gray-400 mt-3 space-y-2">
                  <p><strong>ESP32 Connection Requirements:</strong></p>
                  <ul className="text-xs space-y-1 ml-4">
                    <li>• ESP32 powered on with E-HAPLOS firmware</li>
                    <li>• Bluetooth enabled on your device</li>
                    <li>• Use Chrome, Edge, or Opera browser</li>
                    <li>• ESP32 BLE advertising (device name: "E-HAPLOS")</li>
                  </ul>
                </div>
              )}
              
              {connectionMethod === 'websocket' && !isConnected && (
                <p className="text-sm text-gray-400 mt-3">
                  ESP32 should be connected to WiFi and running WebSocket server on port 81
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Indicators */}
        <Card className="medical-card mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <Signal className="text-medical-accent" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <StatusIndicator status={bluetoothStatus} label="Bluetooth" />
              <StatusIndicator status={fsrStatus} label="FSR Sensors" />
              <StatusIndicator status={eisStatus} label="EIS Readings" />
            </div>
          </CardContent>
        </Card>

        {/* Sensor Data Panels */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          
          {/* FSR Data Panel */}
          <Card className="medical-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
                <Weight className="text-medical-accent" />
                Force-Sensing Resistors (FSR)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-medical-text">FSR 1 (g)</span>
                  <span className="data-value" data-testid="text-fsr1-value">{sensorData.fsr1}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-medical-text">FSR 2 (g)</span>
                  <span className="data-value" data-testid="text-fsr2-value">{sensorData.fsr2}</span>
                </div>
                <div className="border-t border-medical-border pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">Total Pressure (kg)</span>
                    <span className="data-value text-medical-accent" data-testid="text-total-pressure">{sensorData.total}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* EIS Data Panel */}
          <Card className="medical-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
                <Zap className="text-medical-accent" />
                Electrical Impedance Spectroscopy (EIS)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-medical-text">Z Real (Ohms)</span>
                  <span className="data-value" data-testid="text-z-real">{sensorData.zReal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-medical-text">Z Imaginary (Ohms)</span>
                  <span className="data-value" data-testid="text-z-imaginary">{sensorData.zImaginary}</span>
                </div>
                <div className="border-t border-medical-border pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">Magnitude (Ohms)</span>
                    <span className="data-value text-medical-accent" data-testid="text-magnitude">{sensorData.magnitude}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Real-Time Graph */}
        <Card className="medical-card mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <TrendingUp className="text-medical-accent" />
              Real-Time Frequency vs. Impedance Magnitude
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-impedance">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--medical-border)" />
                  <XAxis 
                    dataKey="frequency" 
                    stroke="var(--medical-text-dim)"
                    tick={{ fill: "var(--medical-text-dim)" }}
                    label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: "var(--medical-text)" } }}
                  />
                  <YAxis 
                    stroke="var(--medical-text-dim)"
                    tick={{ fill: "var(--medical-text-dim)" }}
                    label={{ value: 'Magnitude (Ohms)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: "var(--medical-text)" } }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "var(--medical-card)", 
                      border: "1px solid var(--medical-border)",
                      borderRadius: "8px",
                      color: "var(--medical-text)"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="magnitude" 
                    stroke="var(--medical-accent)" 
                    strokeWidth={2}
                    dot={{ fill: "var(--medical-accent)", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: "var(--medical-accent)", strokeWidth: 2, fill: "var(--medical-accent)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Diagnosis Section */}
        <Card className="medical-card mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <Stethoscope className="text-medical-accent" />
              Diagnosis & Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-medical-dark rounded-lg p-4 border-l-4 border-medical-accent">
              <p className="text-medical-text text-lg" data-testid="text-diagnosis">
                {diagnosis}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer Disclaimer */}
        <div className="text-center text-medical-text-dim text-sm border-t border-medical-border pt-6">
          <p>This device is for research and educational purposes only. Results should not be used for medical diagnosis without professional consultation.</p>
          <p className="mt-2">© 2024 E-HAPLOS PROJECT. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
}
