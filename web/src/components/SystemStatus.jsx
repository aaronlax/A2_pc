import React from 'react';
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Tooltip,
  Divider,
  Paper
} from '@mui/material';
import {
  Circle,
  Cloud,
  Computer,
  Videocam,
  PhoneAndroid,
  InfoOutlined
} from '@mui/icons-material';

const SystemStatus = ({ status }) => {
  // Map status to color and label
  const getStatusInfo = (statusText) => {
    const statusMap = {
      'running': { color: 'success.main', label: 'Running' },
      'connected': { color: 'success.main', label: 'Connected' },
      'active': { color: 'success.main', label: 'Active' },
      'inactive': { color: 'warning.main', label: 'Inactive' },
      'disconnected': { color: 'error.main', label: 'Disconnected' },
      'error': { color: 'error.main', label: 'Error' },
      'unknown': { color: 'text.disabled', label: 'Unknown' }
    };
    
    return statusMap[statusText] || statusMap.unknown;
  };
  
  const statusItems = [
    {
      name: 'Server',
      status: status.server,
      icon: <Computer />,
      description: 'Main server for coordination and communication'
    },
    {
      name: 'WSL Processor',
      status: status.wsl,
      icon: <Cloud />,
      description: 'Windows Subsystem for Linux processing module'
    },
    {
      name: 'Pi Client',
      status: status.pi,
      icon: <PhoneAndroid />,
      description: 'Raspberry Pi hardware controller'
    },
    {
      name: 'Camera',
      status: status.camera,
      icon: <Videocam />,
      description: 'Camera device for video stream and capture'
    }
  ];
  
  // Get timestamp in user-friendly format
  const getTimestamp = () => {
    return new Date().toLocaleTimeString();
  };
  
  return (
    <Paper sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          System Status
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Updated: {getTimestamp()}
        </Typography>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      <List dense>
        {statusItems.map((item, index) => {
          const statusInfo = getStatusInfo(item.status);
          
          return (
            <ListItem key={index}>
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.name} 
                secondary={statusInfo.label}
              />
              <Tooltip title={item.description} arrow placement="left">
                <InfoOutlined fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />
              </Tooltip>
              <Circle 
                fontSize="small" 
                sx={{ color: statusInfo.color }}
              />
            </ListItem>
          );
        })}
      </List>
      
      {/* Overall System Status */}
      <Box sx={{ mt: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2">
          Overall System Status
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ mr: 1 }}>
            {Object.values(status).includes('error') ? 'Error' :
             Object.values(status).includes('disconnected') ? 'Degraded' : 'Healthy'}
          </Typography>
          <Circle 
            fontSize="small" 
            sx={{ 
              color: Object.values(status).includes('error') ? 'error.main' :
                    Object.values(status).includes('disconnected') ? 'warning.main' : 'success.main' 
            }}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default SystemStatus; 