// src/components/CameraView.jsx
import React, { useState, useEffect, useRef } from 'react';
import WebSocketService from '../services/WebSocketService';

const CameraView = ({ frameData, detections, showDetections = true }) => {
  const canvasRef = useRef(null);
  const imgRef = useRef(new Image());
  const [fps, setFps] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [errorMessage, setErrorMessage] = useState(null);
  
  // Setup WebSocket event listeners
  useEffect(() => {
    const handleStatusChange = (status) => {
      setConnectionStatus(status.status);
      if (status.status === 'error' || status.status === 'failed') {
        setErrorMessage('Connection error - check server status');
      } else {
        setErrorMessage(null);
      }
    };
    
    // Subscribe to connection status events
    const unsubscribeStatus = WebSocketService.on('status_change', handleStatusChange);
    
    return () => {
      unsubscribeStatus();
    };
  }, []);
  
  // Optimized frame rendering with requestAnimationFrame
  useEffect(() => {
    if (!frameData || !frameData.image) return;
    
    // Update FPS display
    if (frameData.fps) {
      setFps(Math.round(frameData.fps));
    }
    
    // Update last frame time
    setLastFrameTime(Date.now());
    
    // Create image object only once and reuse
    const img = imgRef.current;
    
    // Set the new source
    img.src = `data:image/jpeg;base64,${frameData.image}`;
    
    // Use requestAnimationFrame for smoother rendering
    let animationId;
    
    const renderFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      
      // If image is loaded, draw it
      if (img.complete) {
        // Match canvas size to image if different
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Draw detections if available and showDetections is true
        if (showDetections && detections && detections.length > 0) {
          drawDetections(ctx, detections);
        }
        
        // Draw performance overlay
        drawPerformanceOverlay(ctx, canvas, fps, detections, lastFrameTime);
        
        // Cancel the animation frame since rendering is complete
        cancelAnimationFrame(animationId);
      } else {
        // If image isn't loaded yet, wait until next frame
        animationId = requestAnimationFrame(renderFrame);
      }
    };
    
    // Start the rendering process
    animationId = requestAnimationFrame(renderFrame);
    
    // Clean up on unmount
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [frameData, detections, fps, lastFrameTime, showDetections]);
  
  // Separate functions for drawing detections and overlays
  const drawDetections = (ctx, detections) => {
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.font = '14px Arial';
    
    detections.forEach(det => {
      ctx.strokeRect(det.x, det.y, det.width, det.height);
      
      // Draw label with background for better visibility
      const label = `${det.class}: ${Math.round(det.confidence * 100)}%`;
      const textWidth = ctx.measureText(label).width;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(det.x, det.y - 20, textWidth + 10, 20);
      
      ctx.fillStyle = '#00FF00';
      ctx.fillText(label, det.x + 5, det.y - 5);
    });
  };
  
  const drawPerformanceOverlay = (ctx, canvas, fps, detections, lastFrameTime) => {
    // Draw performance info overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 150, 70);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`FPS: ${fps}`, 20, 30);
    ctx.fillText(`Detections: ${detections?.length || 0}`, 20, 50);
    ctx.fillText(`Status: ${connectionStatus}`, 20, 70);
    
    // Add time since last frame update
    if (lastFrameTime) {
      const timeSinceUpdate = (Date.now() - lastFrameTime) / 1000;
      if (timeSinceUpdate > 3) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.fillRect(10, canvas.height - 40, 230, 30);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Last frame: ${timeSinceUpdate.toFixed(1)}s ago`, 20, canvas.height - 20);
      }
    }
  };
  
  return (
    <div className="camera-view relative">
      <canvas 
        ref={canvasRef} 
        width={640} 
        height={480} 
        style={{ 
          border: '1px solid #ccc', 
          backgroundColor: '#1e1e1e',
          width: '100%',
          height: 'auto'
        }}
      />
      
      {/* Show connection errors */}
      {errorMessage && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 bg-opacity-70 p-4 rounded">
          <p className="text-white font-bold">{errorMessage}</p>
        </div>
      )}
      
      {/* No frames received yet */}
      {!frameData && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 bg-opacity-70 p-4 rounded">
          <p className="text-white">Waiting for video stream...</p>
        </div>
      )}
      
      <div className="camera-info mt-2 flex justify-between">
        <span>{fps} FPS</span>
        {detections && detections.length > 0 && (
          <span>{detections.length} Detection{detections.length !== 1 ? 's' : ''}</span>
        )}
        <span className={`status ${connectionStatus === 'connected' ? 'text-green-500' : 'text-red-500'}`}>
          {connectionStatus}
        </span>
      </div>
    </div>
  );
};

export default CameraView;