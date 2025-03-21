// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Box, Grid, Typography, AppBar, Toolbar, CssBaseline, ThemeProvider, createTheme, Paper, Tab, Tabs } from '@mui/material';
import CameraView from './components/CameraView';
import DepthView from './components/DepthView';
import ServoControl from './components/ServoControl';
import SystemStatus from './components/SystemStatus';
import CameraControl from './components/CameraControl';
import ChatInterface from './components/ChatInterface';
import DetectionPanel from './components/DetectionPanel';
import WebSocketService from './services/WebSocketService';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
  },
});

function App() {
  const [connected, setConnected] = useState(false);
  const [frameData, setFrameData] = useState(null);
  const [depthData, setDepthData] = useState(null);
  const [detections, setDetections] = useState([]);
  const [servoState, setServoState] = useState({ pan: 90, tilt: 90, roll: 0 });
  const [systemStatus, setSystemStatus] = useState({
    server: 'unknown',
    wsl: 'unknown',
    pi: 'unknown',
    camera: 'unknown'
  });
  const [showDetections, setShowDetections] = useState(true);
  const [viewMode, setViewMode] = useState(0); // 0 = color, 1 = depth
  
  useEffect(() => {
    // Connect to WebSocket server
    const unsubscribeConnect = WebSocketService.on('connect', () => {
      setConnected(true);
      setSystemStatus(prev => ({...prev, server: 'connected'}));
      WebSocketService.requestStatus();
    });
    
    const unsubscribeDisconnect = WebSocketService.on('disconnect', () => {
      setConnected(false);
      setSystemStatus(prev => ({...prev, server: 'disconnected'}));
    });
    
    const unsubscribeFrame = WebSocketService.on('frame', (data) => {
      setFrameData(data);
      
      // If depth data is included in the frame
      if (data.depth_data) {
        setDepthData({
          depth_data: data.depth_data,
          width: data.width,
          height: data.height,
          depth_scale: data.depth_scale || 0.001
        });
      }
    });
    
    const unsubscribeDetection = WebSocketService.on('detection', (data) => {
      setDetections(data.detections || []);
    });
    
    const unsubscribeStatus = WebSocketService.on('status', (data) => {
      setSystemStatus({
        server: connected ? 'connected' : 'disconnected',
        wsl: data.wsl_connected ? 'connected' : 'disconnected',
        pi: data.pi_connected ? 'connected' : 'disconnected',
        camera: data.camera_connected ? 'connected' : 'disconnected'
      });
      
      if (data.servo_state) {
        setServoState(data.servo_state);
      }
    });
    
    // Connect to server
    WebSocketService.connectToServer();
    
    // Cleanup
    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeFrame();
      unsubscribeDetection();
      unsubscribeStatus();
      WebSocketService.disconnect();
    };
  }, [connected]);
  
  // Handle camera control commands
  const handleCameraCommand = (command) => {
    WebSocketService.send({
      type: 'camera_control',
      command: command,
      timestamp: Date.now() / 1000
    });
  };
  
  // Handle detection requests
  const handleDetectionRequest = (imageData) => {
    WebSocketService.send({
      type: 'detection_request',
      image: imageData,
      timestamp: Date.now() / 1000
    });
  };
  
  // Handle toggling detection visibility
  const handleToggleDetections = (show) => {
    setShowDetections(show);
  };
  
  // Handle depth mode changes
  const handleDepthModeChange = (mode) => {
    WebSocketService.setDepthMode(mode);
  };
  
  // Handle view mode changes
  const handleViewModeChange = (event, newValue) => {
    setViewMode(newValue);
  };
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              A2 Control Interface
            </Typography>
          </Toolbar>
        </AppBar>
        
        <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left side: Chat interface */}
          <Box sx={{ width: '30%', borderRight: 1, borderColor: 'divider' }}>
            <ChatInterface />
          </Box>
          
          {/* Right side: Camera view and controls */}
          <Box sx={{ width: '70%', display: 'flex', flexDirection: 'column', p: 2, bgcolor: 'grey.100', overflow: 'auto' }}>
            {/* Camera/Depth view tabs */}
            <Box sx={{ mb: 1 }}>
              <Tabs value={viewMode} onChange={handleViewModeChange} aria-label="view mode tabs">
                <Tab label="RGB Camera" />
                <Tab label="Depth View" />
              </Tabs>
            </Box>
            
            {/* Camera/Depth view */}
            <Box sx={{ mb: 2, height: '50%', minHeight: '300px' }}>
              {viewMode === 0 ? (
                <CameraView frameData={frameData} detections={detections} showDetections={showDetections} />
              ) : (
                <DepthView depthData={depthData} onModeChange={handleDepthModeChange} />
              )}
            </Box>
            
            {/* Controls */}
            <Grid container spacing={2}>
              {/* Camera Control */}
              <Grid item xs={12} md={6}>
                <CameraControl onCommand={handleCameraCommand} />
              </Grid>
              
              {/* System Status */}
              <Grid item xs={12} md={6}>
                <SystemStatus status={systemStatus} />
              </Grid>
              
              {/* Servo Control */}
              <Grid item xs={12} md={6}>
                <ServoControl servoState={servoState} />
              </Grid>
              
              {/* Detection Panel */}
              <Grid item xs={12} md={6}>
                <DetectionPanel 
                  onDetectionRequest={handleDetectionRequest}
                  onToggleDetections={handleToggleDetections}
                  detections={detections}
                  frameData={frameData}
                  showDetections={showDetections}
                />
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;