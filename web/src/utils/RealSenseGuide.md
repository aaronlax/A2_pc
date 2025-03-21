# RealSense D455 Integration Guide for Raspberry Pi 5

This guide explains how to set up and configure your Raspberry Pi 5 to capture and stream Intel RealSense D455 camera data to the A2 Control Interface.

## Prerequisites

- Raspberry Pi 5 with Raspberry Pi OS (64-bit recommended)
- Intel RealSense D455 camera
- Python 3.7+ 
- Libraries: librealsense2, numpy, opencv-python, websockets, base64

## Installation

1. Install the RealSense SDK:

```bash
# Add librealsense repository to apt
sudo apt-key adv --keyserver keys.gnupg.net --recv-key F6E65AC044F831AC80A06380C8B3A55A6F3EFCDE || sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-key F6E65AC044F831AC80A06380C8B3A55A6F3EFCDE
sudo add-apt-repository "deb https://librealsense.intel.com/Debian/apt-repo $(lsb_release -cs) main" -u

# Install the SDK
sudo apt-get install librealsense2-dev librealsense2-utils

# Install Python wrapper
pip3 install pyrealsense2
```

2. Install other required packages:

```bash
pip3 install numpy opencv-python websockets
```

## Connecting to the Server

The A2 Control Interface expects WebSocket connections from the Raspberry Pi at:

```
ws://<server-ip>:5000/pi
```

Replace `<server-ip>` with the IP address of your WebSocket server.

## Data Format

When sending data to the A2 Control Interface, your Raspberry Pi application should format the messages as follows:

```json
{
  "type": "frame",
  "frame_id": 123,
  "timestamp": 1679012345.678,
  "image": "base64_encoded_color_image",
  "depth_data": "base64_encoded_depth_map",
  "width": 640,
  "height": 480,
  "depth_scale": 0.001,
  "camera_info": {
    "model": "D455",
    "serial": "camera_serial_number",
    "resolution": [640, 480],
    "fps": 30
  }
}
```

### Keys Explained

- `type`: Always "frame" for camera frames
- `frame_id`: Unique incrementing ID for each frame
- `timestamp`: Unix timestamp (seconds since epoch)
- `image`: Base64-encoded color image from the camera (JPEG format recommended for efficiency)
- `depth_data`: Base64-encoded depth data (typically encoded as 16-bit values)
- `width` & `height`: Frame dimensions
- `depth_scale`: Factor to convert raw depth values to meters (typically 0.001)
- `camera_info`: Information about the camera settings and capabilities

## Example Python Code

Below is a sample Python script that captures D455 data and sends it to the A2 Control Interface:

```python
import pyrealsense2 as rs
import numpy as np
import cv2
import asyncio
import websockets
import json
import base64
import time

# Configure RealSense pipeline
pipeline = rs.pipeline()
config = rs.config()
config.enable_stream(rs.stream.color, 640, 480, rs.format.bgr8, 30)
config.enable_stream(rs.stream.depth, 640, 480, rs.format.z16, 30)

# Start streaming
profile = pipeline.start(config)

# Get depth scale
depth_sensor = profile.get_device().first_depth_sensor()
depth_scale = depth_sensor.get_depth_scale()

# Get camera info
device = profile.get_device()
device_info = device.get_info(rs.camera_info.serial_number)

# Frame counter
frame_id = 0

async def send_frames():
    global frame_id
    uri = "ws://[SERVER_IP]:5000/pi"  # Replace with your server IP
    
    async with websockets.connect(uri) as websocket:
        # Send hello message
        await websocket.send(json.dumps({
            "type": "hello",
            "client": "raspberry_pi",
            "device": "D455",
            "timestamp": time.time()
        }))
        
        try:
            while True:
                # Wait for frames
                frames = pipeline.wait_for_frames()
                depth_frame = frames.get_depth_frame()
                color_frame = frames.get_color_frame()
                
                if not depth_frame or not color_frame:
                    continue
                    
                # Convert frames to numpy arrays
                depth_image = np.asanyarray(depth_frame.get_data())
                color_image = np.asanyarray(color_frame.get_data())
                
                # Encode color image to jpg
                success, encoded_image = cv2.imencode('.jpg', color_image)
                if not success:
                    continue
                    
                # Encode to base64
                color_base64 = base64.b64encode(encoded_image).decode('utf-8')
                
                # Encode depth data to base64
                depth_base64 = base64.b64encode(depth_image.tobytes()).decode('utf-8')
                
                # Create message
                message = {
                    "type": "frame",
                    "frame_id": frame_id,
                    "timestamp": time.time(),
                    "image": color_base64,
                    "depth_data": depth_base64,
                    "width": 640,
                    "height": 480,
                    "depth_scale": depth_scale,
                    "camera_info": {
                        "model": "D455",
                        "serial": device_info,
                        "resolution": [640, 480],
                        "fps": 30
                    }
                }
                
                # Send the message
                await websocket.send(json.dumps(message))
                
                frame_id += 1
                
                # Limit frame rate to reduce network load
                await asyncio.sleep(0.033)  # ~30 FPS
                
        except Exception as e:
            print(f"Error: {e}")
        finally:
            pipeline.stop()

# Run the async WebSocket client
asyncio.get_event_loop().run_until_complete(send_frames())
```

## Troubleshooting

1. **USB Bandwidth Issues**: The D455 requires USB 3.0. If you experience connectivity issues, try:
   - Using a powered USB hub
   - Reducing resolution or frame rate
   - Ensuring your Pi 5 is using USB 3.0 ports

2. **Performance Considerations**:
   - Base64 encoding can be CPU intensive
   - Consider sending every other frame to reduce bandwidth
   - Adjust JPEG quality for color images (e.g., cv2.imencode('.jpg', color_image, [cv2.IMWRITE_JPEG_QUALITY, 85]))

3. **Camera Disconnects**:
   - Implement reconnection logic in case the camera disconnects
   - Check USB cables are securely connected

4. **Network Issues**:
   - Implement WebSocket reconnection logic
   - Consider using a wired network connection for better reliability

## Advanced Features

- **Point Cloud Data**: You can also send 3D point cloud data by converting depth to a point cloud using the RealSense SDK
- **Multiple Cameras**: If using multiple RealSense cameras, include a camera ID in your messages
- **Synchronized Frames**: Use frame synchronization options if timing precision is important 