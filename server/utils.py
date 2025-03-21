import logging
import json
import asyncio
import websockets
import base64
import cv2
import numpy as np
import time

logger = logging.getLogger(__name__)

async def safe_send(websocket, data):
    """Safely send data to a WebSocket with error handling"""
    if websocket is None:
        return False
    
    try:
        # Check if websocket is still open
        if hasattr(websocket, 'closed') and websocket.closed:
            return False
        
        # Convert data to JSON if it's a dict
        message = json.dumps(data) if isinstance(data, dict) else data
        
        # Send the message
        await websocket.send(message)
        return True
    except websockets.exceptions.ConnectionClosedOK:
        # Clean disconnection
        return False
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        return False

async def distribute_to_browsers(browser_clients, message):
    """Send a message to all browser clients efficiently"""
    if not browser_clients:
        return
    
    json_message = json.dumps(message) if isinstance(message, dict) else message
    
    # Create tasks for each client
    tasks = []
    for client in browser_clients:
        try:
            # Use a safe method to check if the connection is still open
            # Instead of checking 'closed' property which doesn't exist
            tasks.append(asyncio.create_task(
                client.send(json_message)
            ))
        except Exception as e:
            logger.error(f"Error adding client to tasks: {e}")
    
    # Execute all sends in parallel if there are any
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

def encode_image(image, quality=75):
    """Encode an image to JPEG and then to base64"""
    try:
        # Encode to JPEG
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        _, buffer = cv2.imencode('.jpg', image, encode_param)
        
        # Convert to base64
        base64_data = base64.b64encode(buffer).decode('utf-8')
        return base64_data
    except Exception as e:
        logger.error(f"Error encoding image: {e}")
        return None

def decode_image(base64_data):
    """Decode a base64 image to numpy array"""
    try:
        # Decode base64
        img_data = base64.b64decode(base64_data)
        
        # Convert to numpy array
        np_arr = np.frombuffer(img_data, np.uint8)
        
        # Decode JPEG
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.error(f"Error decoding image: {e}")
        return None

def get_timestamp():
    """Get current timestamp in milliseconds"""
    return int(time.time() * 1000)