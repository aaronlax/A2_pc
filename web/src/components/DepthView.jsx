import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  ToggleButtonGroup, 
  ToggleButton,
  Slider, 
  FormControlLabel,
  Switch
} from '@mui/material';
import { Colorize, FormatColorFill, Timeline, CenterFocusStrong } from '@mui/icons-material';

const DepthView = ({ depthData, onModeChange }) => {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('color'); // 'color', 'raw', 'heatmap'
  const [minDepth, setMinDepth] = useState(0);
  const [maxDepth, setMaxDepth] = useState(5); // 5 meters default max
  const [autoRange, setAutoRange] = useState(true);
  const [depthStats, setDepthStats] = useState({
    min: 0,
    max: 0,
    avg: 0
  });
  
  useEffect(() => {
    if (!depthData || !depthData.depth_data || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Parse depth data (assuming it's base64 encoded)
    const depthArray = decodeDepthData(depthData.depth_data);
    if (!depthArray) return;
    
    // Calculate statistics if using auto range
    if (autoRange) {
      let min = Infinity;
      let max = 0;
      let sum = 0;
      let count = 0;
      
      // Skip zeros (no data) when calculating min
      for (let i = 0; i < depthArray.length; i++) {
        const depth = depthArray[i];
        if (depth > 0) {
          min = Math.min(min, depth);
          max = Math.max(max, depth);
          sum += depth;
          count++;
        }
      }
      
      // Update depth range and stats
      setMinDepth(min);
      setMaxDepth(max);
      setDepthStats({
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: (sum / count).toFixed(2)
      });
    }
    
    // Create image data
    const width = depthData.width || 640;
    const height = depthData.height || 480;
    const imageData = ctx.createImageData(width, height);
    
    // Fill image data based on mode
    fillImageData(imageData, depthArray, mode, minDepth, maxDepth, width, height);
    
    // Set canvas dimensions and draw
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(imageData, 0, 0);
    
  }, [depthData, mode, minDepth, maxDepth, autoRange]);
  
  // Toggle depth visualization mode
  const handleModeChange = (event, newMode) => {
    if (newMode !== null) {
      setMode(newMode);
      if (onModeChange) onModeChange(newMode);
    }
  };
  
  // Toggle auto range
  const handleAutoRangeChange = (event) => {
    setAutoRange(event.target.checked);
  };
  
  // Handle depth range change
  const handleDepthRangeChange = (event, newValue) => {
    setMinDepth(newValue[0]);
    setMaxDepth(newValue[1]);
  };
  
  // Decode depth data from base64 to array of depth values
  const decodeDepthData = (base64Data) => {
    try {
      // This is a simplified version - actual implementation depends on how
      // your data is encoded. You may need to decode from base64 to a typed array
      
      // Example for 16-bit depth data encoded as base64:
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert to 16-bit depth values
      const depthArray = new Uint16Array(bytes.buffer);
      return depthArray;
      
    } catch (err) {
      console.error('Error decoding depth data:', err);
      return null;
    }
  };
  
  // Fill image data based on selected visualization mode
  const fillImageData = (imageData, depthArray, mode, minDepth, maxDepth, width, height) => {
    const depthScale = depthData?.depth_scale || 0.001; // meters per unit
    
    for (let i = 0; i < depthArray.length; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      const pixelIndex = (y * width + x) * 4;
      
      // Get depth in meters
      const depth = depthArray[i] * depthScale;
      
      // Skip rendering pixels with no depth data (value 0)
      if (depth === 0) {
        imageData.data[pixelIndex] = 0;
        imageData.data[pixelIndex + 1] = 0;
        imageData.data[pixelIndex + 2] = 0;
        imageData.data[pixelIndex + 3] = 0; // transparent
        continue;
      }
      
      // Normalize depth to 0-1 range
      const normalizedDepth = Math.max(0, Math.min(1, (depth - minDepth) / (maxDepth - minDepth)));
      
      switch (mode) {
        case 'raw':
          // Grayscale representation
          const gray = Math.floor(normalizedDepth * 255);
          imageData.data[pixelIndex] = gray;
          imageData.data[pixelIndex + 1] = gray;
          imageData.data[pixelIndex + 2] = gray;
          imageData.data[pixelIndex + 3] = 255;
          break;
          
        case 'heatmap':
          // Rainbow colormap (blue to red)
          const hue = (1 - normalizedDepth) * 240; // 240=blue, 0=red
          const [r, g, b] = hsvToRgb(hue / 360, 1, 1);
          imageData.data[pixelIndex] = r;
          imageData.data[pixelIndex + 1] = g;
          imageData.data[pixelIndex + 2] = b;
          imageData.data[pixelIndex + 3] = 255;
          break;
          
        case 'color':
        default:
          // Colored representation (close=red, far=blue)
          imageData.data[pixelIndex] = Math.floor((1 - normalizedDepth) * 255);     // R
          imageData.data[pixelIndex + 1] = Math.floor(normalizedDepth * 255);       // G
          imageData.data[pixelIndex + 2] = Math.floor(normalizedDepth * 255);       // B
          imageData.data[pixelIndex + 3] = 255;
      }
    }
  };
  
  // Helper function to convert HSV to RGB
  const hsvToRgb = (h, s, v) => {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };
  
  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Depth View
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
          aria-label="depth visualization mode"
        >
          <ToggleButton value="color" aria-label="color">
            <Colorize />
          </ToggleButton>
          <ToggleButton value="raw" aria-label="raw">
            <FormatColorFill />
          </ToggleButton>
          <ToggleButton value="heatmap" aria-label="heatmap">
            <Timeline />
          </ToggleButton>
        </ToggleButtonGroup>
        
        <FormControlLabel
          control={
            <Switch 
              checked={autoRange} 
              onChange={handleAutoRangeChange}
              size="small"
            />
          }
          label="Auto Range"
        />
      </Box>
      
      {!autoRange && (
        <Box sx={{ px: 2, mb: 2 }}>
          <Typography variant="body2" id="depth-range-slider" gutterBottom>
            Depth Range (m): {minDepth.toFixed(2)} - {maxDepth.toFixed(2)}
          </Typography>
          <Slider
            value={[minDepth, maxDepth]}
            onChange={handleDepthRangeChange}
            min={0}
            max={10}
            step={0.1}
            aria-labelledby="depth-range-slider"
          />
        </Box>
      )}
      
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#1e1e1e', position: 'relative' }}>
        {!depthData?.depth_data ? (
          <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
            <CenterFocusStrong sx={{ fontSize: 40, opacity: 0.5, mb: 2 }} />
            <Typography>No depth data available</Typography>
          </Box>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        )}
        
        {/* Stats overlay */}
        {depthData?.depth_data && (
          <Box sx={{ 
            position: 'absolute', 
            bottom: 10, 
            left: 10, 
            p: 1, 
            bgcolor: 'rgba(0,0,0,0.7)', 
            borderRadius: 1,
            color: 'white',
            fontSize: '12px'
          }}>
            <Typography variant="caption" component="div">
              Min: {depthStats.min}m | Max: {depthStats.max}m | Avg: {depthStats.avg}m
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default DepthView; 