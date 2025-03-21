import asyncio
import json
import logging
import time
import base64
import cv2
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import struct
import traceback

import utils
import config

logger = logging.getLogger(__name__)

async def handle_browser_message(websocket, message, browser_clients, pi_client, wsl_processor, servo_state):
    """Handle messages from browser clients"""
    try:
        data = json.loads(message)
        message_type = data.get("type", "unknown")
        
        logger.debug(f"Received browser message of type: {message_type}")
        
        if message_type == "ping":
            # Handle ping message
            await utils.safe_send(websocket, {
                "type": "pong",
                "timestamp": time.time()
            })
        
        elif message_type == "hello":
            # Handle hello message from browser
            logger.info(f"Received hello from browser client")
            # Respond with welcome message
            await utils.safe_send(websocket, {
                "type": "welcome",
                "message": "Welcome to the server",
                "server_time": time.time(),
                "pi_connected": pi_client is not None,
                "wsl_connected": wsl_processor is not None
            })
        
        elif message_type == "servo_control":
            # Handle servo control message
            if pi_client:
                # Update local servo state
                if "pan" in data:
                    servo_state["pan"] = data["pan"]
                if "tilt" in data:
                    servo_state["tilt"] = data["tilt"]
                if "roll" in data:
                    servo_state["roll"] = data["roll"]
                
                # Forward to Pi
                await utils.safe_send(pi_client, {
                    "type": "control",
                    "action": "move_servos",
                    "params": servo_state,
                    "timestamp": time.time()
                })
                
                # Confirm to browser
                await utils.safe_send(websocket, {
                    "type": "servo_updated",
                    "state": servo_state,
                    "timestamp": time.time()
                })
            else:
                await utils.safe_send(websocket, {
                    "type": "error",
                    "error": "Pi not connected",
                    "timestamp": time.time()
                })
        
        elif message_type == "request_status":
            # Send system status
            await utils.safe_send(websocket, {
                "type": "status",
                "pi_connected": pi_client is not None,
                "wsl_connected": wsl_processor is not None,
                "browser_clients": len(browser_clients),
                "servo_state": servo_state,
                "timestamp": time.time()
            })
        
        else:
            logger.warning(f"Unknown browser message type: {message_type}")
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON from browser client")
    except Exception as e:
        logger.error(f"Error handling browser message: {e}")

async def handle_pi_message(websocket, message, browser_clients, wsl_processor, frame_queue, processed_frames):
    """Handle messages from Pi client"""
    try:
        # Check if message is binary data (for frames)
        if isinstance(message, bytes):
            # Parse the binary frame format
            try:
                # Read header (14 bytes base)
                header_format = '<If??'
                header_size = struct.calcsize(header_format)
                
                if len(message) < header_size:
                    logger.error(f"Binary message too short: {len(message)} bytes")
                    return
                
                # Extract base header
                frame_id, timestamp, has_color, has_depth = struct.unpack(header_format, message[:header_size])
                
                logger.debug(f"Received binary frame {frame_id} - color: {has_color}, depth: {has_depth}")
                
                # Initialize variables
                color_data = None
                depth_data = None
                depth_scale = 0.001  # Default value
                
                # Current position in message
                pos = header_size
                
                # Extract color frame if present
                if has_color:
                    # Read color data length (4 bytes)
                    if pos + 4 > len(message):
                        logger.error("Binary message truncated at color length")
                        return
                    
                    color_length = struct.unpack('<I', message[pos:pos+4])[0]
                    pos += 4
                    
                    # Read color data
                    if pos + color_length > len(message):
                        logger.error("Binary message truncated at color data")
                        return
                    
                    color_bytes = message[pos:pos+color_length]
                    color_data = base64.b64encode(color_bytes).decode('utf-8')
                    pos += color_length
                
                # Extract depth frame if present
                if has_depth:
                    # Read depth data length (4 bytes)
                    if pos + 4 > len(message):
                        logger.error("Binary message truncated at depth length")
                        return
                    
                    depth_length = struct.unpack('<I', message[pos:pos+4])[0]
                    pos += 4
                    
                    # Read depth data
                    if pos + depth_length > len(message):
                        logger.error("Binary message truncated at depth data")
                        return
                    
                    depth_bytes = message[pos:pos+depth_length]
                    depth_data = base64.b64encode(depth_bytes).decode('utf-8')
                    pos += depth_length
                    
                    # Read depth scale (4 bytes)
                    if pos + 4 > len(message):
                        logger.error("Binary message truncated at depth scale")
                        return
                    
                    depth_scale = struct.unpack('<f', message[pos:pos+4])[0]
                
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
                                "image": color_data
                            }),
                            timeout=0.1
                        )
                        
                        # Forward to WSL processor
                        await utils.safe_send(wsl_processor, {
                            "type": "frame_to_process",
                            "frame_id": frame_id,
                            "timestamp": timestamp,
                            "image": color_data,
                            "depth_data": depth_data,
                            "depth_scale": depth_scale
                        })
                    except asyncio.TimeoutError:
                        logger.warning("Processing queue full, skipping frame")
                
                # Create message for browser clients
                frame_message = {
                    "type": "frame",
                    "frame_id": frame_id,
                    "timestamp": timestamp,
                    "image": color_data,
                    "processed": False,
                    "binary_received": True
                }
                
                # Add depth data if available
                if has_depth:
                    frame_message["depth_data"] = depth_data
                    frame_message["depth_scale"] = depth_scale
                
                # Forward to browser clients efficiently
                await utils.distribute_to_browsers(browser_clients, frame_message)
            
            except Exception as e:
                logger.error(f"Error parsing binary message: {e}")
                logger.error(traceback.format_exc())
            
            return
        
        # Handle JSON messages
        data = json.loads(message)
        message_type = data.get("type", "unknown")
        
        logger.debug(f"Received Pi message of type: {message_type}")
        
        if message_type == "ping":
            # Handle ping message
            await utils.safe_send(websocket, {
                "type": "pong",
                "timestamp": time.time()
            })
        
        elif message_type == "frame":
            # Handle video frame
            frame_id = data.get("frame_id", 0)
            timestamp = data.get("timestamp", time.time())
            
            # Check if we should process this frame
            should_process = wsl_processor is not None
            
            if should_process:
                # Add to processing queue
                try:
                    # Don't block if queue is full
                    await asyncio.wait_for(
                        frame_queue.put({
                            "frame_id": frame_id,
                            "timestamp": timestamp,
                            "image": data.get("image"),
                            "camera_info": data.get("camera_info", {})
                        }),
                        timeout=0.1
                    )
                    
                    # Forward to WSL processor
                    await utils.safe_send(wsl_processor, {
                        "type": "frame_to_process",
                        "frame_id": frame_id,
                        "timestamp": timestamp,
                        "image": data.get("image"),
                        "camera_info": data.get("camera_info", {})
                    })
                except asyncio.TimeoutError:
                    logger.warning("Processing queue full, skipping frame")
            
            # Always forward frames to browser clients - include depth data if available
            frame_data = {
                "type": "frame",
                "frame_id": frame_id,
                "timestamp": timestamp,
                "image": data.get("image"),
                "processed": False,
                "camera_info": data.get("camera_info", {})
            }
            
            # Include depth data if available
            if "depth_data" in data:
                logger.info(f"Forwarding frame with depth data to browser clients")
                frame_data["depth_data"] = data.get("depth_data")
                frame_data["depth_scale"] = data.get("depth_scale", 0.001)
                frame_data["width"] = data.get("width", 640)
                frame_data["height"] = data.get("height", 480)
            
            # Use more efficient parallel sending
            await utils.distribute_to_browsers(browser_clients, frame_data)
        
        elif message_type == "telemetry":
            # Handle telemetry data
            # Forward to all browser clients
            await utils.distribute_to_browsers(browser_clients, data)
        
        elif message_type == "hello":
            # Extract client capabilities
            client_info = data.get('client_info', {})
            supports_binary = client_info.get('supports_binary', False)
            
            logger.info(f"Received hello from Pi: {data.get('hostname', 'unknown')}, binary support: {supports_binary}")
            
            # Respond with welcome message
            await utils.safe_send(websocket, {
                "type": "welcome",
                "message": "Welcome to the server",
                "server_time": time.time(),
                "binary_frames_supported": True  # Tell client we support binary frames
            })
        
        else:
            logger.warning(f"Unknown Pi message type: {message_type}")
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON from Pi client")
    except Exception as e:
        logger.error(f"Error handling Pi message: {e}")
        logger.error(traceback.format_exc())

async def handle_wsl_message(websocket, message, browser_clients, pi_client, processed_frames):
    """Handle messages from WSL processor"""
    try:
        data = json.loads(message)
        message_type = data.get("type", "unknown")
        
        logger.debug(f"Received WSL message of type: {message_type}")
        
        if message_type == "ping":
            # Handle ping message
            await utils.safe_send(websocket, {
                "type": "pong",
                "timestamp": time.time()
            })
        
        elif message_type == "processed_frame":
            # Handle processed frame result
            frame_id = data.get("frame_id", 0)
            
            # Store processing result
            processed_frames[frame_id] = {
                "detections": data.get("detections", []),
                "timestamp": time.time()
            }
            
            # Forward result to Pi client
            if pi_client:
                await utils.safe_send(pi_client, {
                    "type": "detection_result",
                    "frame_id": frame_id,
                    "detections": data.get("detections", []),
                    "timestamp": time.time()
                })
            
            # Forward to browser clients
            for client in browser_clients:
                await utils.safe_send(client, {
                    "type": "detection_result",
                    "frame_id": frame_id,
                    "detections": data.get("detections", []),
                    "timestamp": time.time(),
                    "processing_time": data.get("processing_time", 0)
                })
        
        else:
            logger.warning(f"Unknown WSL message type: {message_type}")
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON from WSL processor")
    except Exception as e:
        logger.error(f"Error handling WSL message: {e}")