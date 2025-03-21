import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Switch,
  FormControlLabel
} from '@mui/material';
import { 
  HighlightAlt, 
  Visibility, 
  VisibilityOff,
  PhotoCamera,
  CameraEnhance
} from '@mui/icons-material';

const DetectionPanel = ({ 
  onDetectionRequest, 
  onToggleDetections,
  detections, 
  frameData,
  showDetections 
}) => {
  const [autoDetect, setAutoDetect] = useState(false);
  const [lastDetectionTime, setLastDetectionTime] = useState(null);
  
  // Request object detection on the current frame
  const requestDetection = () => {
    if (frameData && frameData.image) {
      onDetectionRequest(frameData.image);
      setLastDetectionTime(new Date().toLocaleTimeString());
    }
  };
  
  // Toggle automatic detection
  const toggleAutoDetect = () => {
    setAutoDetect(!autoDetect);
  };
  
  // Toggle detection visibility
  const toggleDetectionVisibility = () => {
    onToggleDetections(!showDetections);
  };
  
  // Auto detection effect
  useEffect(() => {
    let interval;
    if (autoDetect) {
      interval = setInterval(() => {
        if (frameData && frameData.image) {
          onDetectionRequest(frameData.image);
          setLastDetectionTime(new Date().toLocaleTimeString());
        }
      }, 5000); // Run detection every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoDetect, frameData, onDetectionRequest]);
  
  // Get color for object class
  const getColorForClass = (className) => {
    const colorMap = {
      person: '#f44336', // red
      chair: '#4caf50', // green
      dog: '#2196f3',   // blue
      cat: '#ff9800',   // orange
      car: '#9c27b0',   // purple
      bicycle: '#00bcd4', // cyan
      default: '#ff9800' // orange
    };
    
    return colorMap[className?.toLowerCase()] || colorMap.default;
  };
  
  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Object Detection
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button 
          variant="contained" 
          color="primary"
          startIcon={<CameraEnhance />}
          onClick={requestDetection}
          disabled={!frameData || !frameData.image}
        >
          Detect Objects
        </Button>
        
        <FormControlLabel
          control={
            <Switch 
              checked={autoDetect}
              onChange={toggleAutoDetect}
              color="primary"
            />
          }
          label="Auto Detect"
        />
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1">
          Detection Results {detections.length > 0 && `(${detections.length})`}
        </Typography>
        
        <Button
          size="small"
          startIcon={showDetections ? <VisibilityOff /> : <Visibility />}
          onClick={toggleDetectionVisibility}
        >
          {showDetections ? "Hide" : "Show"} Boxes
        </Button>
      </Box>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2 }}>
        {detections.length > 0 ? (
          <List dense>
            {detections.map((detection, index) => (
              <ListItem 
                key={index} 
                divider={index < detections.length - 1}
                sx={{ py: 1 }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box 
                        sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          bgcolor: getColorForClass(detection.class),
                          mr: 1 
                        }} 
                      />
                      <Typography variant="body1">
                        {detection.class || 'Unknown'}
                      </Typography>
                    </Box>
                  }
                  secondary={`Confidence: ${(detection.confidence * 100).toFixed(1)}%`}
                />
                <Chip 
                  size="small" 
                  label={`ID: ${index + 1}`}
                  sx={{ ml: 1 }}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: 'text.secondary',
            p: 3
          }}>
            <HighlightAlt sx={{ fontSize: 40, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2" align="center">
              No objects detected in the current frame.
            </Typography>
            <Typography variant="body2" align="center" sx={{ mt: 1 }}>
              Click "Detect Objects" to analyze the current camera frame.
            </Typography>
          </Box>
        )}
      </Box>
      
      <Box sx={{ 
        mt: 'auto', 
        pt: 1, 
        borderTop: 1, 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="caption" color="text.secondary">
          {autoDetect ? 'Auto detection enabled' : 'Auto detection disabled'}
        </Typography>
        {lastDetectionTime && (
          <Typography variant="caption" color="text.secondary">
            Last detection: {lastDetectionTime}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default DetectionPanel; 