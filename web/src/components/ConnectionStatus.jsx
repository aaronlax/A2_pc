import React, { useState, useEffect } from 'react';
import WebSocketService from '../services/WebSocketService';

const ConnectionStatus = () => {
  const [status, setStatus] = useState({ 
    status: 'disconnected', 
    framesReceived: 0,
    timeSinceLastFrame: null
  });
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    // Update status every second
    const interval = setInterval(() => {
      const stats = WebSocketService.getStats();
      setStatus(stats);
    }, 1000);
    
    const handleStatusChange = (newStatus) => {
      setStatus(prev => ({ ...prev, ...newStatus }));
    };
    
    // Listen for status changes
    const unsubscribe = WebSocketService.on('status_change', handleStatusChange);
    
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);
  
  // Determine status color
  const getStatusColor = () => {
    switch (status.status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      case 'failed': return 'bg-red-700';
      default: return 'bg-gray-500';
    }
  };
  
  return (
    <div className="connection-status">
      <div 
        className={`status-indicator p-2 rounded-md ${getStatusColor()} text-white cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex justify-between items-center">
          <span className="font-bold">WebSocket: {status.status}</span>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      
      {expanded && (
        <div className="status-details bg-gray-800 text-white p-3 rounded-b-md">
          <div className="grid grid-cols-2 gap-2">
            <div>Status:</div>
            <div>{status.status}</div>
            
            <div>Frames received:</div>
            <div>{status.framesReceived}</div>
            
            {status.timeSinceLastFrame !== null && (
              <>
                <div>Last frame:</div>
                <div>{status.timeSinceLastFrame.toFixed(1)}s ago</div>
              </>
            )}
          </div>
          
          <div className="mt-2">
            <button 
              className="bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded mr-2"
              onClick={() => WebSocketService.connectToServer()}
            >
              Reconnect
            </button>
            
            <button 
              className="bg-gray-500 hover:bg-gray-700 text-white py-1 px-2 rounded"
              onClick={() => WebSocketService.requestStatus()}
            >
              Check Status
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus; 