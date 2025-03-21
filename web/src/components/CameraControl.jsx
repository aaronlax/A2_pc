import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Grid, 
  Slider, 
  Paper,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  ArrowUpward,
  ArrowDownward,
  ArrowBack,
  ArrowForward,
  CameraAlt,
  ZoomIn,
  ZoomOut,
  Videocam,
  VideocamOff,
  RestartAlt,
  SaveAlt,
  CenterFocusStrong
} from '@mui/icons-material';

const CameraControl = ({ onCommand }) => {
  const [streaming, setStreaming] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [moveInterval, setMoveInterval] = useState(null);
  const [lastCapture, setLastCapture] = useState(null);
  
  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (moveInterval) {
        clearInterval(moveInterval);
      }
    };
  }, [moveInterval]);

  const handleZoomChange = (event, newValue) => {
    setZoomLevel(newValue);
    onCommand(`zoom_${newValue}`);
  };

  const toggleStreaming = () => {
    const newState = !streaming;
    setStreaming(newState);
    onCommand(newState ? 'start_stream' : 'stop_stream');
  };

  const takeSnapshot = () => {
    onCommand('take_snapshot');
    setLastCapture(new Date().toLocaleTimeString());
  };
  
  // Start continuous movement
  const startContinuousMove = (direction) => {
    // Clear any existing interval
    if (moveInterval) {
      clearInterval(moveInterval);
    }
    
    // Send initial command
    onCommand(`move_${direction}`);
    
    // Set up interval for repeated commands
    const interval = setInterval(() => {
      onCommand(`move_${direction}`);
    }, 200); // Send command every 200ms
    
    setMoveInterval(interval);
  };
  
  // Stop continuous movement
  const stopContinuousMove = () => {
    if (moveInterval) {
      clearInterval(moveInterval);
      setMoveInterval(null);
      onCommand('stop_movement');
    }
  };
  
  const handleReset = () => {
    onCommand('reset_camera');
    setZoomLevel(1);
  };
  
  const saveSettings = () => {
    onCommand('save_settings');
  };

  return (
    <Paper sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
      <Typography variant="h6" gutterBottom>
        Camera Control
      </Typography>
      
      <Grid container spacing={1} sx={{ mb: 2 }}>
        <Grid item xs={12} container justifyContent="center">
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<ArrowUpward />}
            onMouseDown={() => startContinuousMove('up')}
            onMouseUp={stopContinuousMove}
            onMouseLeave={stopContinuousMove}
            onTouchStart={() => startContinuousMove('up')}
            onTouchEnd={stopContinuousMove}
          >
            Up
          </Button>
        </Grid>
        
        <Grid item xs={4} container justifyContent="flex-end">
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<ArrowBack />}
            onMouseDown={() => startContinuousMove('left')}
            onMouseUp={stopContinuousMove}
            onMouseLeave={stopContinuousMove}
            onTouchStart={() => startContinuousMove('left')}
            onTouchEnd={stopContinuousMove}
          >
            Left
          </Button>
        </Grid>
        
        <Grid item xs={4} container justifyContent="center">
          <Button 
            variant="contained" 
            color="secondary"
            startIcon={<CameraAlt />}
            onClick={takeSnapshot}
          >
            Capture
          </Button>
        </Grid>
        
        <Grid item xs={4}>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<ArrowForward />}
            onMouseDown={() => startContinuousMove('right')}
            onMouseUp={stopContinuousMove}
            onMouseLeave={stopContinuousMove}
            onTouchStart={() => startContinuousMove('right')}
            onTouchEnd={stopContinuousMove}
          >
            Right
          </Button>
        </Grid>
        
        <Grid item xs={12} container justifyContent="center">
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<ArrowDownward />}
            onMouseDown={() => startContinuousMove('down')}
            onMouseUp={stopContinuousMove}
            onMouseLeave={stopContinuousMove}
            onTouchStart={() => startContinuousMove('down')}
            onTouchEnd={stopContinuousMove}
          >
            Down
          </Button>
        </Grid>
      </Grid>
      
      <Box sx={{ mb: 2 }}>
        <Typography id="zoom-slider" gutterBottom>
          Zoom Control
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <ZoomOut />
          </Grid>
          <Grid item xs>
            <Slider
              value={zoomLevel}
              onChange={handleZoomChange}
              aria-labelledby="zoom-slider"
              step={0.1}
              min={1}
              max={5}
            />
          </Grid>
          <Grid item>
            <ZoomIn />
          </Grid>
        </Grid>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button
          variant="contained"
          color={streaming ? "error" : "success"}
          startIcon={streaming ? <VideocamOff /> : <Videocam />}
          onClick={toggleStreaming}
        >
          {streaming ? "Stop Stream" : "Start Stream"}
        </Button>
        
        <Box>
          <Tooltip title="Reset Camera Settings">
            <IconButton color="primary" onClick={handleReset} sx={{ mr: 1 }}>
              <RestartAlt />
            </IconButton>
          </Tooltip>
          <Tooltip title="Center Camera">
            <IconButton color="primary" onClick={() => onCommand('center_camera')} sx={{ mr: 1 }}>
              <CenterFocusStrong />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save Camera Settings">
            <IconButton color="primary" onClick={saveSettings}>
              <SaveAlt />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {lastCapture && (
        <Box sx={{ mt: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1, textAlign: 'center' }}>
          <Typography variant="body2">
            Last Capture: {lastCapture}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default CameraControl; 