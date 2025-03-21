// src/components/ServoControl.jsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Slider, Button, Grid, CircularProgress } from '@mui/material';
import WebSocketService from '../services/WebSocketService';

const ServoControl = ({ servoState }) => {
  const [pan, setPan] = useState(90);
  const [tilt, setTilt] = useState(90);
  const [roll, setRoll] = useState(0);
  const [speedValue, setSpeedValue] = useState(0.5);
  const [connected, setConnected] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  
  // Update local state when servo state changes
  useEffect(() => {
    if (servoState) {
      setPan(servoState.pan || 90);
      setTilt(servoState.tilt || 90);
      setRoll(servoState.roll || 0);
      
      // If we received servo state, we must be connected
      setConnected(true);
    }
  }, [servoState]);
  
  // Throttled version of move to prevent too many requests
  const throttledMove = (fn) => {
    if (!window.moveTimeout) {
      fn();
      window.moveTimeout = setTimeout(() => {
        window.moveTimeout = null;
      }, 100);
    }
  };
  
  const handlePanChange = (e, value) => {
    setPan(value);
    throttledMove(() => WebSocketService.setServoPosition({ pan: value, tilt, roll }));
  };
  
  const handleTiltChange = (e, value) => {
    setTilt(value);
    throttledMove(() => WebSocketService.setServoPosition({ pan, tilt: value, roll }));
  };
  
  const handleRollChange = (e, value) => {
    setRoll(value);
    throttledMove(() => WebSocketService.setServoPosition({ pan, tilt, roll: value }));
  };
  
  const handleSpeedChange = (e, value) => {
    setSpeedValue(value);
    throttledMove(() => WebSocketService.setServoSpeed(value));
  };
  
  const handleCenter = () => {
    WebSocketService.centerServos();
    // Update local values to reflect center position
    setPan(90);
    setTilt(90);
    setRoll(0);
  };
  
  const handleCalibrate = () => {
    setIsCalibrating(true);
    WebSocketService.calibrateServos();
    
    // Assume calibration takes about 5 seconds
    setTimeout(() => {
      setIsCalibrating(false);
    }, 5000);
  };
  
  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
      <Typography variant="h6" gutterBottom>
        Servo Control
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ 
          width: 10, 
          height: 10, 
          borderRadius: '50%', 
          bgcolor: connected ? 'success.main' : 'error.main',
          mr: 1 
        }} />
        <Typography variant="body2" color={connected ? 'text.primary' : 'error'}>
          {connected ? 'Connected' : 'Disconnected'}
        </Typography>
      </Box>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4}>
          <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="body2">Pan: {pan}°</Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="body2">Tilt: {tilt}°</Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="body2">Roll: {roll}°</Typography>
          </Box>
        </Grid>
      </Grid>
      
      <Box sx={{ mb: 3 }}>
        <Typography id="pan-slider" gutterBottom>Pan</Typography>
        <Slider
          value={pan}
          onChange={handlePanChange}
          aria-labelledby="pan-slider"
          min={0}
          max={180}
          disabled={!connected}
        />
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography id="tilt-slider" gutterBottom>Tilt</Typography>
        <Slider
          value={tilt}
          onChange={handleTiltChange}
          aria-labelledby="tilt-slider"
          min={0}
          max={180}
          disabled={!connected}
        />
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography id="roll-slider" gutterBottom>Roll</Typography>
        <Slider
          value={roll}
          onChange={handleRollChange}
          aria-labelledby="roll-slider"
          min={-30}
          max={30}
          disabled={!connected}
        />
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography id="speed-slider" gutterBottom>
          Speed: {speedValue.toFixed(1)}
        </Typography>
        <Slider
          value={speedValue}
          onChange={handleSpeedChange}
          aria-labelledby="speed-slider"
          step={0.1}
          min={0}
          max={1}
          disabled={!connected}
        />
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Button 
            variant="contained" 
            color="primary"
            fullWidth
            onClick={handleCenter}
            disabled={!connected}
          >
            Center All
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Button 
            variant="contained" 
            color="secondary"
            fullWidth
            onClick={handleCalibrate}
            disabled={!connected || isCalibrating}
            startIcon={isCalibrating ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isCalibrating ? 'Calibrating...' : 'Calibrate'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ServoControl;