"""
Utility functions for WebSocket handling and message distribution
"""

import json
import logging
import asyncio
import time
import traceback
import struct
import base64

logger = logging.getLogger(__name__)

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
        
async def handle_ping_pong(websocket):
    """
    Handle ping messages from clients and respond with pong
    to keep connection alive.
    """
    try:
        while True:
            message = await websocket.recv()
            data = json.loads(message)
            
            if data.get('type') == 'ping':
                await safe_send(websocket, {
                    'type': 'pong',
                    'timestamp': time.time()
                })
    except Exception as e:
        logger.error(f"Ping handler error: {e}")
        # Let the main handler deal with the connection error

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
            client_type = data.get('client', 'unknown')
            logger.info(f"Client connected: {client_type} with capabilities: {client_info}")
            return client_info
        else:
            logger.warning(f"Expected hello message, got: {data.get('type')}")
            return {}
    except Exception as e:
        logger.error(f"Error processing client info: {e}")
        return {}

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
                    await safe_send(wsl_processor, {
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
            
            await distribute_to_browsers(browser_clients, frame_message)
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