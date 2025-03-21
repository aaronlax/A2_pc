"""
Binary Frame Transfer Implementation for Pi Server
Add this code to your server.py file to enable efficient binary frame transfer.
"""

import cv2
import time
import struct
import logging
import json
import base64
import asyncio
import traceback

logger = logging.getLogger(__name__)

async def send_binary_frame(websocket, frame, frame_id):
    """Send a frame as binary data instead of base64 JSON for better performance"""
    try:
        # Encode frame to JPEG
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, config.JPEG_QUALITY]
        ret, jpeg = cv2.imencode('.jpg', frame, encode_params)
        
        if not ret:
            logger.error("Failed to encode frame")
            return False
        
        # Create binary message:
        # First 4 bytes: frame_id (uint32)
        # Next 4 bytes: timestamp (float32)
        # Rest: JPEG data
        frame_id_bytes = frame_id.to_bytes(4, byteorder='little')
        timestamp = time.time()
        timestamp_bytes = struct.pack('<f', timestamp)
        
        # Combine header and image data
        header = frame_id_bytes + timestamp_bytes
        binary_data = header + jpeg.tobytes()
        
        # Send as binary
        await websocket.send(binary_data)
        return True
    
    except Exception as e:
        logger.error(f"Error sending binary frame: {e}")
        return False


# Example usage in your main camera loop:
"""
async def camera_websocket_handler(websocket, path):
    client_info = await get_client_info(websocket)
    supports_binary = client_info.get('supports_binary', False)
    
    # Camera setup and frame capture loop
    frame_id = 0
    
    while True:
        # Capture frame from camera
        ret, frame = camera.read()
        if not ret:
            continue
            
        frame_id += 1
        
        # Check if client supports binary transfer
        if supports_binary:
            # Send frame as binary data (much more efficient)
            success = await send_binary_frame(websocket, frame, frame_id)
        else:
            # Fall back to traditional JSON+base64 method
            success = await send_json_frame(websocket, frame, frame_id)
            
        if not success:
            break
            
        await asyncio.sleep(0.01)  # Control frame rate
"""

# Helper functions for the server

async def get_client_info(websocket):
    """
    Wait for and process the 'hello' message from the client
    to determine its capabilities.
    """
    try:
        message = await websocket.recv()
        data = json.loads(message)
        
        if data.get('type') == 'hello':
            client_info = data.get('client_info', {})
            logger.info(f"Client connected: {data.get('client')} with capabilities: {client_info}")
            return client_info
        else:
            logger.warning(f"Expected hello message, got: {data.get('type')}")
            return {}
    except Exception as e:
        logger.error(f"Error processing client info: {e}")
        return {}


async def ping_handler(websocket):
    """
    Handle ping messages from clients and respond with pong
    to keep connection alive.
    """
    try:
        while True:
            message = await websocket.recv()
            data = json.loads(message)
            
            if data.get('type') == 'ping':
                await websocket.send(json.dumps({
                    'type': 'pong',
                    'timestamp': time.time()
                }))
    except Exception as e:
        logger.error(f"Ping handler error: {e}")
        # Let the main handler deal with the connection error


# In the handle_pi_message function, add binary frame handling
async def handle_pi_message(websocket, message, browser_clients, wsl_processor, frame_queue, processed_frames):
    """Handle messages from Pi client"""
    try:
        # Check if message is binary data (for frames)
        if isinstance(message, bytes):
            # Extract frame_id and timestamp from binary header
            header = message[:8]
            frame_data = message[8:]
            
            frame_id = int.from_bytes(header[:4], byteorder='little')
            timestamp = struct.unpack('<f', header[4:8])[0]
            
            logger.debug(f"Received binary frame {frame_id}, size: {len(message)} bytes")
            
            # Convert binary to base64 for browser clients that expect it
            frame_base64 = base64.b64encode(frame_data).decode('utf-8')
            
            # Should we process this frame?
            should_process = wsl_processor is not None
            
            if should_process:
                # Add to processing queue
                try:
                    # Don't block if queue is full
                    await asyncio.wait_for(
                        frame_queue.put({
                            "frame_id": frame_id,
                            "timestamp": timestamp,
                            "image": frame_base64
                        }),
                        timeout=0.1
                    )
                    
                    # Forward to WSL processor
                    await utils.safe_send(wsl_processor, {
                        "type": "frame_to_process",
                        "frame_id": frame_id,
                        "timestamp": timestamp,
                        "image": frame_base64
                    })
                except asyncio.TimeoutError:
                    logger.warning("Processing queue full, skipping frame")
            
            # Forward to browser clients
            frame_message = {
                "type": "frame",
                "frame_id": frame_id,
                "timestamp": timestamp,
                "image": frame_base64,
                "processed": False
            }
            
            await utils.distribute_to_browsers(browser_clients, frame_message)
            return
        
        # Handle JSON messages
        data = json.loads(message)
        message_type = data.get("type", "unknown")
        
        logger.debug(f"Received Pi message of type: {message_type}")
        
        # Rest of the original function...
        # Your existing JSON message handling code
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON from Pi client")
    except Exception as e:
        logger.error(f"Error handling Pi message: {e}")
        logger.error(traceback.format_exc())

# Add to utils.py
class utils:
    @staticmethod
    async def safe_send(websocket, message):
        """Safely send a message to a WebSocket client"""
        try:
            if websocket and not websocket.closed:
                if isinstance(message, dict):
                    await websocket.send(json.dumps(message))
                else:
                    await websocket.send(message)
                return True
            return False
        except Exception as e:
            logger.error(f"Error in safe_send: {e}")
            return False

    @staticmethod
    async def distribute_to_browsers(browser_clients, message):
        """Send a message to all browser clients efficiently"""
        if not browser_clients:
            return
        
        json_message = json.dumps(message) if isinstance(message, dict) else message
        
        # Create tasks for each client
        tasks = []
        for client in browser_clients:
            if not client.closed:
                tasks.append(asyncio.create_task(
                    client.send(json_message)
                ))
        
        # Execute all sends in parallel if there are any
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True) 