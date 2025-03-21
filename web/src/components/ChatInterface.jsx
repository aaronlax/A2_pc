import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  List, 
  ListItem, 
  CircularProgress,
  Divider
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your robotic camera assistant. How can I help you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate response
    setTimeout(() => {
      const assistantMessage = { 
        role: 'assistant', 
        content: 'This is a simulated response. The chat functionality will be connected to the backend in the future.' 
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      bgcolor: 'background.paper' 
    }}>
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        bgcolor: 'primary.main',
        color: 'primary.contrastText'
      }}>
        <Typography variant="h6">Chat Interface</Typography>
      </Box>
      
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        p: 2, 
        display: 'flex', 
        flexDirection: 'column',
        gap: 2
      }}>
        {messages.map((msg, idx) => (
          <Box 
            key={idx} 
            sx={{ 
              display: 'flex', 
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              mb: 1
            }}
          >
            <Paper 
              elevation={1}
              sx={{ 
                maxWidth: '80%', 
                p: 2, 
                borderRadius: 2,
                bgcolor: msg.role === 'user' 
                  ? 'primary.main'
                  : msg.role === 'error'
                  ? 'error.light'
                  : 'grey.100',
                color: msg.role === 'user' 
                  ? 'primary.contrastText'
                  : msg.role === 'error'
                  ? 'error.contrastText'
                  : 'text.primary'
              }}
            >
              <Typography variant="body1">{msg.content}</Typography>
            </Paper>
          </Box>
        ))}
        
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
            <Paper 
              elevation={1}
              sx={{ 
                p: 2, 
                borderRadius: 2,
                bgcolor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <CircularProgress size={16} />
              <CircularProgress size={16} sx={{ animationDelay: '0.2s' }} />
              <CircularProgress size={16} sx={{ animationDelay: '0.4s' }} />
            </Paper>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      <Divider />
      
      <Box 
        component="form" 
        onSubmit={handleSubmit}
        sx={{ 
          p: 2, 
          borderTop: 1, 
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 1
        }}
      >
        <TextField
          fullWidth
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          variant="outlined"
          size="small"
          disabled={isLoading}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          endIcon={<SendIcon />}
          disabled={isLoading}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
};

export default ChatInterface; 