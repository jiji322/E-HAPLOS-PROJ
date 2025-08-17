// E-HAPLOS PROJECT JavaScript Logic
// Real ESP32 Device Connection with FSR and EIS sensors

class EHaplosDevice {
    constructor() {
        // State variables
        this.isConnected = false;
        this.isCalibrating = false;
        this.isConnecting = false;
        this.frequencyIndex = 0;
        this.sweepInterval = null;
        this.calibrationTimeout = null;
        
        // ESP32 communication
        this.serialPort = null;
        this.reader = null;
        this.writer = null;
        this.esp32IP = null; // For WiFi connection
        this.websocket = null;
        
        // Frequency values as specified
        this.frequencies = [100000.0, 125892.0, 158489.0, 199526.0, 251188.0, 316228.0, 398107.0, 501187.0];
        
        // Chart instance
        this.chart = null;
        this.chartData = [];
        
        // Data buffer for parsing ESP32 responses
        this.dataBuffer = '';
        
        // DOM elements
        this.initializeElements();
        this.initializeChart();
        this.setupEventListeners();
        
        // Initialize display
        this.resetDisplay();
        
        // Check for Web Serial API support
        this.checkBrowserSupport();
    }

    initializeElements() {
        // Button elements
        this.connectionBtn = document.getElementById('connectionBtn');
        this.btnText = this.connectionBtn.querySelector('.btn-text');
        
        // Status indicators
        this.bluetoothStatus = document.getElementById('bluetoothStatus');
        this.fsrStatus = document.getElementById('fsrStatus');
        this.eisStatus = document.getElementById('eisStatus');
        
        // Data display elements
        this.fsr1Value = document.getElementById('fsr1Value');
        this.fsr2Value = document.getElementById('fsr2Value');
        this.totalPressure = document.getElementById('totalPressure');
        this.zRealValue = document.getElementById('zRealValue');
        this.zImaginaryValue = document.getElementById('zImaginaryValue');
        this.magnitudeValue = document.getElementById('magnitudeValue');
        
        // Diagnosis element
        this.diagnosisText = document.getElementById('diagnosisText');
        
        // Patient info (optional for future use)
        this.patientName = document.getElementById('patientName');
        this.patientAge = document.getElementById('patientAge');
    }

    initializeChart() {
        const ctx = document.getElementById('impedanceChart').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Impedance Magnitude (Ohms)',
                    data: [],
                    borderColor: '#2196f3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#2196f3',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Frequency (Hz)',
                            color: '#e0e0e0'
                        },
                        ticks: {
                            color: '#b0b0b0'
                        },
                        grid: {
                            color: '#333333'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Magnitude (Ohms)',
                            color: '#e0e0e0'
                        },
                        ticks: {
                            color: '#b0b0b0'
                        },
                        grid: {
                            color: '#333333'
                        },
                        min: 0,
                        max: 5500
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e0e0e0'
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e1e1e',
                        titleColor: '#e0e0e0',
                        bodyColor: '#e0e0e0',
                        borderColor: '#333333',
                        borderWidth: 1
                    }
                }
            }
        });
    }

    setupEventListeners() {
        this.connectionBtn.addEventListener('click', () => this.handleConnection());
    }

    checkBrowserSupport() {
        if (!('serial' in navigator)) {
            console.warn('Web Serial API not supported. Fallback to WiFi connection.');
            this.addConnectionModeSelector();
        }
    }

    addConnectionModeSelector() {
        // Add connection mode selector to the page
        const connectionSection = document.querySelector('.connection-section');
        const modeSelector = document.createElement('div');
        modeSelector.className = 'connection-mode';
        modeSelector.innerHTML = `
            <div style="margin-bottom: 1rem;">
                <label style="color: var(--medical-text); margin-bottom: 0.5rem; display: block;">Connection Mode:</label>
                <select id="connectionMode" style="padding: 0.5rem; background: var(--medical-card); color: var(--medical-text); border: 1px solid var(--medical-border); border-radius: 0.25rem;">
                    <option value="wifi">WiFi (WebSocket)</option>
                    <option value="serial" ${('serial' in navigator) ? '' : 'disabled'}>USB Serial ${('serial' in navigator) ? '' : '(Not Supported)'}</option>
                </select>
            </div>
            <div id="wifiSettings" style="margin-bottom: 1rem;">
                <input type="text" id="esp32IP" placeholder="ESP32 IP Address (e.g., 192.168.1.100)" 
                       style="width: 100%; padding: 0.5rem; background: var(--medical-card); color: var(--medical-text); border: 1px solid var(--medical-border); border-radius: 0.25rem;">
            </div>
        `;
        connectionSection.insertBefore(modeSelector, this.connectionBtn);
    }

    async handleConnection() {
        if (!this.isConnected) {
            await this.connectDevice();
        } else {
            this.disconnectDevice();
        }
    }

    async connectDevice() {
        this.isConnecting = true;
        this.updateConnectionButton();
        
        try {
            const connectionMode = document.getElementById('connectionMode')?.value || 'wifi';
            
            if (connectionMode === 'serial' && 'serial' in navigator) {
                await this.connectSerial();
            } else {
                await this.connectWiFi();
            }
            
            this.isConnected = true;
            this.isConnecting = false;
            this.isCalibrating = true;
            
            // Update status indicators
            this.setStatusIndicator(this.bluetoothStatus, 'success');
            this.setStatusIndicator(this.eisStatus, 'warning');
            
            this.updateConnectionButton();
            this.updateDiagnosis();
            
            // Send calibration command to ESP32
            await this.sendCommand('CALIBRATE');
            
            // Start calibration phase (5 seconds)
            this.calibrationTimeout = setTimeout(() => {
                this.isCalibrating = false;
                this.setStatusIndicator(this.eisStatus, 'success');
                this.updateDiagnosis();
                this.startDataCollection();
            }, 5000);
            
        } catch (error) {
            console.error('Connection failed:', error);
            this.isConnecting = false;
            this.updateConnectionButton();
            this.updateDiagnosis('Connection failed: ' + error.message);
        }
    }

    async connectSerial() {
        try {
            // Request serial port
            this.serialPort = await navigator.serial.requestPort();
            await this.serialPort.open({ baudRate: 115200 });
            
            // Get reader and writer
            this.reader = this.serialPort.readable.getReader();
            this.writer = this.serialPort.writable.getWriter();
            
            // Start reading data
            this.startSerialReading();
            
            console.log('Serial connection established');
            
        } catch (error) {
            throw new Error('Serial connection failed: ' + error.message);
        }
    }

    async connectWiFi() {
        const ipInput = document.getElementById('esp32IP');
        const ip = ipInput?.value.trim() || '192.168.1.100';
        
        try {
            // Try WebSocket connection first
            const wsUrl = `ws://${ip}:81`;
            this.websocket = new WebSocket(wsUrl);
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, 5000);
                
                this.websocket.onopen = () => {
                    clearTimeout(timeout);
                    console.log('WebSocket connection established');
                    this.setupWebSocketHandlers();
                    resolve();
                };
                
                this.websocket.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(new Error('WebSocket connection failed'));
                };
            });
            
        } catch (error) {
            throw new Error('WiFi connection failed: ' + error.message);
        }
    }

    async setupWebSocketHandlers() {
        this.websocket.onmessage = (event) => {
            this.handleESP32Data(event.data);
        };
        
        this.websocket.onclose = () => {
            console.log('WebSocket connection closed');
            if (this.isConnected) {
                this.disconnectDevice();
                this.updateDiagnosis('Connection lost to ESP32 device');
            }
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    async startSerialReading() {
        try {
            while (this.reader && this.isConnected) {
                const { value, done } = await this.reader.read();
                if (done) break;
                
                const text = new TextDecoder().decode(value);
                this.dataBuffer += text;
                
                // Process complete lines
                const lines = this.dataBuffer.split('\n');
                this.dataBuffer = lines.pop() || ''; // Keep incomplete line
                
                for (const line of lines) {
                    if (line.trim()) {
                        this.handleESP32Data(line.trim());
                    }
                }
            }
        } catch (error) {
            console.error('Serial reading error:', error);
        }
    }

    handleESP32Data(data) {
        try {
            // Parse ESP32 data - expecting JSON format like:
            // {"fsr1":25.3,"fsr2":18.7,"freq":100000,"zReal":2450.2,"zImag":1230.5,"mag":2750.8}
            const sensorData = JSON.parse(data);
            
            if (sensorData.fsr1 !== undefined && sensorData.fsr2 !== undefined) {
                this.updateFSRData(sensorData);
            }
            
            if (sensorData.freq !== undefined && sensorData.zReal !== undefined) {
                this.updateEISData(sensorData);
            }
            
        } catch (error) {
            // Handle non-JSON data or status messages
            if (data.includes('CALIBRATION_COMPLETE')) {
                this.isCalibrating = false;
                this.setStatusIndicator(this.eisStatus, 'success');
                this.updateDiagnosis();
            } else if (data.includes('ERROR')) {
                console.error('ESP32 Error:', data);
                this.updateDiagnosis('ESP32 Error: ' + data);
            }
        }
    }

    updateFSRData(data) {
        const fsr1 = parseFloat(data.fsr1).toFixed(1);
        const fsr2 = parseFloat(data.fsr2).toFixed(1);
        const total = ((parseFloat(data.fsr1) + parseFloat(data.fsr2)) / 1000).toFixed(3);
        
        this.fsr1Value.textContent = fsr1;
        this.fsr2Value.textContent = fsr2;
        this.totalPressure.textContent = total;
        
        // Update sensor status based on pressure
        const pressureKg = parseFloat(total);
        if (pressureKg >= 0.020) {
            this.setStatusIndicator(this.fsrStatus, 'success');
        } else {
            this.setStatusIndicator(this.fsrStatus, 'error');
        }
    }

    updateEISData(data) {
        const zReal = parseFloat(data.zReal).toFixed(2);
        const zImag = parseFloat(data.zImag).toFixed(2);
        const magnitude = parseFloat(data.mag).toFixed(2);
        const frequency = parseFloat(data.freq);
        
        this.zRealValue.textContent = zReal;
        this.zImaginaryValue.textContent = zImag;
        this.magnitudeValue.textContent = magnitude;
        
        // Update chart with real data
        this.updateChart(frequency, magnitude);
        
        // Update diagnosis based on real readings
        const totalPressure = this.totalPressure.textContent;
        this.updateDiagnosisFromData(magnitude, totalPressure);
    }

    async sendCommand(command) {
        try {
            if (this.writer) {
                // Serial connection
                const encoder = new TextEncoder();
                await this.writer.write(encoder.encode(command + '\n'));
            } else if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                // WebSocket connection
                this.websocket.send(command);
            }
        } catch (error) {
            console.error('Failed to send command:', error);
        }
    }

    startDataCollection() {
        // Send command to start frequency sweep
        this.sendCommand('START_SWEEP');
        
        // Clear existing chart data
        this.chart.data.labels = [];
        this.chart.data.datasets[0].data = [];
        this.chart.update();
    }

    disconnectDevice() {
        this.isConnected = false;
        this.isCalibrating = false;
        
        // Clear intervals and timeouts
        if (this.sweepInterval) {
            clearInterval(this.sweepInterval);
            this.sweepInterval = null;
        }
        
        if (this.calibrationTimeout) {
            clearTimeout(this.calibrationTimeout);
            this.calibrationTimeout = null;
        }
        
        // Close connections
        if (this.reader) {
            this.reader.cancel();
            this.reader = null;
        }
        
        if (this.writer) {
            this.writer.close();
            this.writer = null;
        }
        
        if (this.serialPort) {
            this.serialPort.close();
            this.serialPort = null;
        }
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        // Reset all status indicators
        this.setStatusIndicator(this.bluetoothStatus, 'inactive');
        this.setStatusIndicator(this.fsrStatus, 'inactive');
        this.setStatusIndicator(this.eisStatus, 'inactive');
        
        this.resetDisplay();
        this.updateConnectionButton();
        this.updateDiagnosis();
    }

    updateChart(frequency, magnitude) {
        this.chart.data.labels.push(frequency.toLocaleString());
        this.chart.data.datasets[0].data.push(parseFloat(magnitude));
        this.chart.update('none'); // No animation for real-time updates
    }

    updateDiagnosisFromData(magnitude, totalPressure) {
        let diagnosisText;
        
        if (!this.isConnected) {
            diagnosisText = "Device not connected. Please connect E-HAPLOS device to begin analysis.";
        } else if (this.isCalibrating) {
            diagnosisText = "EIS is calibrating in the air...";
        } else if (totalPressure && parseFloat(totalPressure) < 0.020) {
            diagnosisText = "Insufficient contact pressure. Please ensure proper sensor contact.";
        } else if (magnitude) {
            const mag = parseFloat(magnitude);
            if (mag < 2500) {
                diagnosisText = "Normal soft tissue detected. Impedance values within expected range.";
            } else if (mag > 4000) {
                diagnosisText = "Possible dense mass detected. Higher impedance values observed. Further evaluation recommended.";
            } else {
                diagnosisText = "Tissue analysis in progress. Impedance values being evaluated.";
            }
        } else {
            diagnosisText = "Device connected. Waiting for sensor data...";
        }
        
        this.diagnosisText.textContent = diagnosisText;
    }

    updateDiagnosis(customMessage = null) {
        if (customMessage) {
            this.diagnosisText.textContent = customMessage;
            return;
        }
        
        let diagnosisText;
        
        if (!this.isConnected) {
            diagnosisText = "Device not connected. Please connect E-HAPLOS device to begin analysis.";
        } else if (this.isCalibrating) {
            diagnosisText = "EIS is calibrating in the air...";
        } else {
            diagnosisText = "Device connected. Ready for measurements.";
        }
        
        this.diagnosisText.textContent = diagnosisText;
    }

    updateConnectionButton() {
        if (this.isConnecting) {
            this.btnText.textContent = "Connecting...";
            this.connectionBtn.disabled = true;
            this.connectionBtn.classList.add('pulse');
        } else if (this.isConnected) {
            this.btnText.textContent = "Disconnect Device";
            this.connectionBtn.disabled = false;
            this.connectionBtn.classList.remove('pulse');
        } else {
            this.btnText.textContent = "Connect E-HAPLOS Device";
            this.connectionBtn.disabled = false;
            this.connectionBtn.classList.remove('pulse');
        }
    }

    setStatusIndicator(element, status) {
        // Remove all status classes
        element.classList.remove('status-inactive', 'status-success', 'status-error', 'status-warning');
        // Add the new status class
        element.classList.add(`status-${status}`);
    }

    resetDisplay() {
        // Reset sensor values
        this.fsr1Value.textContent = "--";
        this.fsr2Value.textContent = "--";
        this.totalPressure.textContent = "--";
        this.zRealValue.textContent = "--";
        this.zImaginaryValue.textContent = "--";
        this.magnitudeValue.textContent = "--";
        
        // Clear chart
        if (this.chart) {
            this.chart.data.labels = [];
            this.chart.data.datasets[0].data = [];
            this.chart.update();
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the device when the page loads
document.addEventListener('DOMContentLoaded', function() {
    window.ehaplosDevice = new EHaplosDevice();
});