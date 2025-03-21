# A2_pc

# A2 Object Detection System README

## Project Overview

The A2 Object Detection System is a sophisticated project designed to integrate advanced object detection capabilities with a robotic camera system. This system utilizes a combination of server-side and client-side components to handle real-time video processing, object detection, and camera control, all interfaced through a robust web application.

## Main Components and Relationships

### Server-Side Components
- **WebSocket Server (`server.py`)**: Manages WebSocket connections and routes messages between browser clients, a Raspberry Pi client, and a WSL processor based on the path ("/browser", "/pi", "/wsl").
- **Configuration (`config.py`)**: Stores server settings including host, port, and detailed video and ML configuration parameters.
- **Logger Configuration (`logger_config.py`)**: Configures logging across all server-side scripts to standardize output and error logging.
- **Utility Functions (`utils.py`)**: Provides essential functions for WebSocket handling, message distribution, and server-side utilities.
- **Binary Frame Implementation (`server_binary_frame_implementation.py`)**: Enhances data transfer efficiency by implementing binary frame transfer between the server and clients.

### Client-Side Components (Web Application)
- **Main App Interface (`App.jsx`)**: Renders the primary user interface for the A2 Object Detection System, integrating various components.
- **Camera Control (`CameraControl.jsx`)**: Facilitates user interaction with camera controls such as zoom, pan, and capture functions.
- **Additional UI Components**:
  - **Camera View (`CameraView.jsx`)**: Displays live camera feed with overlay options for object detection and performance metrics.
  - **System Status (`SystemStatus.jsx`)**: Shows the operational status of system components like the server, camera, and processors.
  - **Depth View and Detection Panels**: Provide interfaces for depth visualization and object detection toggles.

### Integration with Hardware
- **Raspberry Pi & RealSense Camera**: Detailed setup and integration instructions are provided in `RealSenseGuide.md`, which includes steps for configuring the Raspberry Pi with the RealSense D455 camera to work within this system.

## Setup and Installation

### Server Setup
1. Ensure Python 3.8+ is installed.
2. Install dependencies:
   ```bash
   pip install websockets asyncio opencv-python numpy
   ```
3. Start the server:
   ```bash
   python server.py
   ```

### Client Setup
1. Ensure Node.js and npm are installed.
2. Install project dependencies:
   ```bash
   cd path/to/webapp
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

## Usage Examples

### Connecting to the WebSocket Server
```javascript
import WebSocketService from './WebSocketService';

const wsService = new WebSocketService();
wsService.connect('ws://localhost:5000/browser');
```

### Sending Camera Control Commands
```javascript
wsService.setServoPosition({ pan: 90, tilt: 45 });
```

## API Documentation

Refer to the inline documentation within each script for detailed API usage. Key classes and methods include:
- `WebSocketService`: Handles all WebSocket communications.
- `connect()`, `disconnect()`, `send()`: Manage WebSocket connections and message sending.

## Configuration Options

- **Server Configuration (`config.py`)**: Modify host, port, and video settings according to your network and hardware setup.
- **Client Configuration (`package.json`)**: Includes scripts and dependencies for the client-side application.
- **Camera Settings (`CameraControl.jsx`)**: Adjust default camera settings and control options as needed.

For further customization and detailed API usage, refer to the source code documentation provided within each module.

---
*This README was automatically generated on 2025-03-21 09:11:30*
