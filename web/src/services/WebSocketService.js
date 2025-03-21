// src/services/WebSocketService.js
class WebSocketService {
  static instance = null;
  callbacks = {};
  socket = null;
  connectionAttempts = 0;
  maxAttempts = 5;
  reconnectTimeout = null;
  initialReconnectDelay = 10000;
  isConnecting = false;
  
  // Add status tracking
  connectionStatus = 'disconnected';
  lastFrameReceived = 0;
  framesReceived = 0;
  
  static getInstance() {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }
  
  connect(url) {
    if (this.isConnecting) {
      console.log('Connection attempt already in progress, ignoring');
      return;
    }
    
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.isConnecting = true;
    console.log(`Connecting to WebSocket: ${url}`);
    this.connectionStatus = 'connecting';
    this.trigger('status_change', { status: 'connecting' });
    
    try {
      this.socket = new WebSocket(url);
      
      // Set binary type to arraybuffer for more efficient binary data handling
      this.socket.binaryType = 'arraybuffer';
      
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.connectionStatus = 'connected';
        this.connectionAttempts = 0;
        this.isConnecting = false;
        
        this.send({
          type: 'hello',
          client: 'browser',
          client_info: {
            user_agent: navigator.userAgent,
            timestamp: Date.now() / 1000,
            supports_binary: true,  // Indicate we support binary frame transfers
            supports_webcodecs: typeof VideoDecoder !== 'undefined'
          }
        });
        
        this.trigger('connect');
        this.trigger('status_change', { status: 'connected' });
        
        // Start ping interval
        this.startPingInterval();
      };
      
      this.socket.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        this.connectionStatus = 'disconnected';
        this.isConnecting = false;
        this.trigger('disconnect');
        this.trigger('status_change', { status: 'disconnected', code: event.code, reason: event.reason });
        
        // Clear ping interval
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
        
        // If we got a rate limit exceeded message, wait much longer
        if (event.code === 1008 && event.reason === "Rate limit exceeded") {
          console.log("Rate limit exceeded, waiting 30 seconds before reconnecting");
          const delay = 30000; // Wait 30 seconds before trying again
          this.reconnectTimeout = setTimeout(() => this.connect(url), delay);
          return;
        }
        
        if (this.connectionAttempts < this.maxAttempts) {
          this.connectionAttempts++;
          const delay = Math.min(120000, this.initialReconnectDelay * Math.pow(2, this.connectionAttempts - 1));
          console.log(`Reconnecting in ${delay}ms (attempt ${this.connectionAttempts} of ${this.maxAttempts})`);
          
          this.reconnectTimeout = setTimeout(() => this.connect(url), delay);
        } else {
          console.error('Maximum reconnection attempts reached. Please refresh the page to try again.');
          this.trigger('status_change', { status: 'failed' });
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.trigger('error', error);
        this.trigger('status_change', { status: 'error', error });
      };
      
      this.socket.onmessage = (event) => {
        try {
          // Check if the message is binary data or text
          if (event.data instanceof ArrayBuffer) {
            // Handle binary frame data
            this.handleBinaryFrame(event.data);
            return;
          }
          
          const data = JSON.parse(event.data);
          
          // Handle different message types
          switch (data.type) {
            case 'frame':
              // Update stats
              this.framesReceived++;
              this.lastFrameReceived = Date.now();
              
              // Check if this frame contains RealSense depth data
              if (data.depth_data || data.point_cloud) {
                console.log('WebSocketService received depth data:', {
                  frameId: data.frame_id,
                  hasDepthData: !!data.depth_data,
                  dataLength: data.depth_data ? data.depth_data.length : 0,
                  timestamp: new Date().toISOString()
                });
                
                // Trigger both standard frame and depth data events
                this.trigger('frame', data);
                this.trigger('depth_data', data);
              } else {
                // Standard frame only
                this.trigger('frame', data);
              }
              break;
            case 'status':
              this.trigger('status', data);
              break;
            case 'detection_result':
              this.trigger('detection', data);
              break;
            case 'depth_info':
              // Dedicated message for depth camera info
              this.trigger('depth_info', data);
              break;
            case 'pong':
              this.trigger('pong', data);
              break;
            default:
              this.trigger('message', data);
          }
        } catch (err) {
          console.error('Error processing message:', err);
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      this.connectionStatus = 'failed';
      this.trigger('status_change', { status: 'failed', error: err });
    }
  }
  
  // Handle binary frame data - much more efficient than base64
  handleBinaryFrame(buffer) {
    // First 8 bytes: frame_id (uint32) + timestamp (float32)
    const headerView = new DataView(buffer, 0, 8);
    const frameId = headerView.getUint32(0, true);
    const timestamp = headerView.getFloat32(4, true);
    
    // The rest is the JPEG image data
    const imageData = buffer.slice(8);
    
    // Convert to base64 for backward compatibility
    const base64Image = this.arrayBufferToBase64(imageData);
    
    // Update stats
    this.framesReceived++;
    this.lastFrameReceived = Date.now();
    
    // Create frame object compatible with existing code
    const frameData = {
      type: 'frame',
      frame_id: frameId,
      timestamp: timestamp,
      image: base64Image,
      binary_transfer: true
    };
    
    this.trigger('frame', frameData);
  }
  
  // Convert ArrayBuffer to Base64
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
  
  startPingInterval() {
    // Send ping every 10 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      this.send({
        type: 'ping',
        timestamp: Date.now() / 1000
      });
    }, 10000);
  }
  
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.connectionStatus = 'disconnected';
  }
  
  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (typeof message === 'object') {
        this.socket.send(JSON.stringify(message));
      } else {
        this.socket.send(message);
      }
      return true;
    } else {
      console.warn('Cannot send message, WebSocket not connected');
      return false;
    }
  }
  
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
    
    return () => this.off(event, callback);
  }
  
  off(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }
  
  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }
  
  connectToServer() {
    // Prevent multiple calls to connectToServer from creating multiple connections
    if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) {
      console.log('Already connected or connecting');
      return;
    }
    
    // Fixed hostname to localhost for development to avoid any hostname issues
    const host = 'localhost';
    const port = 5000;  // Match the server port
    
    this.connect(`ws://${host}:${port}/browser`);
  }
  
  // Get connection stats
  getStats() {
    return {
      status: this.connectionStatus,
      framesReceived: this.framesReceived,
      lastFrameReceived: this.lastFrameReceived,
      timeSinceLastFrame: this.lastFrameReceived ? (Date.now() - this.lastFrameReceived) / 1000 : null
    };
  }
  
  setServoPosition(position) {
    return this.send({
      type: 'servo_control',
      ...position,
      timestamp: Date.now() / 1000
    });
  }
  
  centerServos() {
    return this.send({
      type: 'servo_control',
      pan: 90,
      tilt: 90,
      roll: 0,
      timestamp: Date.now() / 1000
    });
  }
  
  requestStatus() {
    return this.send({
      type: 'request_status',
      timestamp: Date.now() / 1000
    });
  }
  
  setServoSpeed(speed) {
    return this.send({
      type: 'servo_control',
      speed: speed,
      timestamp: Date.now() / 1000
    });
  }
  
  calibrateServos() {
    return this.send({
      type: 'servo_calibrate',
      timestamp: Date.now() / 1000
    });
  }
  
  // Request a specific depth visualization mode
  setDepthMode(mode) {
    return this.send({
      type: 'depth_mode',
      mode: mode, // 'color', 'raw', 'heatmap'
      timestamp: Date.now() / 1000
    });
  }
  
  // Request depth information
  requestDepthInfo() {
    return this.send({
      type: 'request_depth_info',
      timestamp: Date.now() / 1000
    });
  }
}

export default WebSocketService.getInstance();