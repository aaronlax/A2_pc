#!/usr/bin/env python3
import asyncio
import websockets
import logging
import json
import time
import base64
import cv2
import numpy as np
import os
import signal
from http import HTTPStatus
from concurrent.futures import ThreadPoolExecutor
import traceback
import struct

# Import message handling functions
from message_handler import handle_browser_message, handle_pi_message, handle_wsl_message
import config
from utils import safe_send, distribute_to_browsers

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("server_log.txt"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Connected clients
browser_clients = set()
browser_client_info = {}  # Track more info about clients
pi_client = None
wsl_processor = None

# Track connections to prevent flooding
last_connection_time = {}
connection_limit_window = 60  # seconds - increased to a full minute
max_connections_per_window = 30  # increased to allow more reconnections
whitelisted_ips = {"127.0.0.1", "localhost"}

# Servo state
servo_state = {
    "pan": 90,
    "tilt": 90,
    "roll": 0
}

# Queue for frames waiting for processing
frame_queue = asyncio.Queue(maxsize=5)
processed_frames = {}

async def distribute_message(message, exclude=None):
    """Send a message to all connected clients except excluded ones"""
    tasks = []
    
    # Send to browser clients
    for client in browser_clients:
        if client != exclude:
            tasks.append(asyncio.create_task(safe_send(client, message)))
    
    # Send to Pi client
    if pi_client and pi_client != exclude:
        tasks.append(asyncio.create_task(safe_send(pi_client, message)))
    
    # Send to WSL processor
    if wsl_processor and wsl_processor != exclude:
        tasks.append(asyncio.create_task(safe_send(wsl_processor, message)))
    
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

async def handle_browser_client(websocket):
    """Handle browser client connections"""
    global browser_clients, browser_client_info
    
    # Extract client info for logging
    client_address = websocket.remote_address
    client_ip = client_address[0] if client_address else "unknown"
    
    # Check for connection flooding
    current_time = time.time()
    if client_ip != "unknown" and client_ip not in whitelisted_ips:
        if client_ip not in last_connection_time:
            last_connection_time[client_ip] = []
        
        # Check recent connections
        recent_connections = [t for t in last_connection_time[client_ip] 
                           if current_time - t < connection_limit_window]
        
        # Update history
        recent_connections.append(current_time)
        last_connection_time[client_ip] = recent_connections
        
        # Check if too many connections
        if len(recent_connections) > max_connections_per_window:
            logger.warning(f"Connection rate limiting applied for {client_ip}")
            await safe_send(websocket, {
                "type": "error",
                "error": "Rate limit exceeded"
            })
            await websocket.close(1008, "Rate limit exceeded")
            return
    
    # Add to clients
    browser_clients.add(websocket)
    client_id = f"browser_{int(time.time())}"
    browser_client_info[websocket] = {
        "ip": client_ip,
        "id": client_id,
        "connected_at": time.time(),
        "last_active": time.time(),
        "frames_sent": 0
    }
    
    logger.info(f"Browser client connected: {client_ip}, ID: {client_id}")
    
    try:
        # Send connection confirmation
        await safe_send(websocket, {
            "type": "connected",
            "message": "Connected to server",
            "client_id": client_id,
            "server_time": time.time()
        })
        
        # Process incoming messages
        async for message in websocket:
            try:
                # Update activity time
                browser_client_info[websocket]["last_active"] = time.time()
                
                # Handle message
                await handle_browser_message(websocket, message, browser_clients, pi_client, wsl_processor, servo_state)
                
            except Exception as e:
                logger.error(f"Error handling browser message: {e}")
                logger.error(traceback.format_exc())
    
    except websockets.exceptions.ConnectionClosedOK:
        logger.info(f"Browser client disconnected normally: {client_ip}")
    except Exception as e:
        logger.error(f"Browser client error: {e}")
    finally:
        browser_clients.discard(websocket)
        if websocket in browser_client_info:
            del browser_client_info[websocket]
        logger.info(f"Browser client removed: {client_ip}")

async def handle_pi_client(websocket):
    """Handle Raspberry Pi client connection"""
    global pi_client
    
    # Only allow one Pi connection at a time
    if pi_client:
        logger.warning("A Pi client is already connected, rejecting new connection")
        await websocket.close(1008, "Another Pi is already connected")
        return
    
    client_address = websocket.remote_address
    logger.info(f"Pi client connected: {client_address}")
    pi_client = websocket
    
    try:
        # Send confirmation
        await safe_send(websocket, {
            "type": "connected",
            "message": "Connected as Pi client",
            "server_time": time.time()
        })
        
        # Notify browser clients
        await distribute_message({
            "type": "status",
            "status": "pi_connected",
            "timestamp": time.time()
        }, exclude=websocket)
        
        # Handle incoming messages
        async for message in websocket:
            try:
                await handle_pi_message(websocket, message, browser_clients, wsl_processor, frame_queue, processed_frames)
            except Exception as e:
                logger.error(f"Error handling Pi message: {e}")
                logger.error(traceback.format_exc())
    
    except websockets.exceptions.ConnectionClosedOK:
        logger.info(f"Pi client disconnected normally")
    except Exception as e:
        logger.error(f"Pi client error: {e}")
    finally:
        if pi_client == websocket:
            pi_client = None
            logger.info("Pi client removed")
            
            # Notify browser clients
            await distribute_message({
                "type": "status",
                "status": "pi_disconnected",
                "timestamp": time.time()
            })

async def handle_wsl_processor(websocket):
    """Handle WSL processor connection"""
    global wsl_processor
    
    # Only allow one WSL processor at a time
    if wsl_processor:
        logger.warning("A WSL processor is already connected, rejecting new connection")
        await websocket.close(1008, "Another WSL processor is already connected")
        return
    
    client_address = websocket.remote_address
    logger.info(f"WSL processor connected: {client_address}")
    wsl_processor = websocket
    
    try:
        # Send confirmation
        await safe_send(websocket, {
            "type": "connected",
            "message": "Connected as WSL processor",
            "server_time": time.time()
        })
        
        # Handle incoming messages
        async for message in websocket:
            try:
                await handle_wsl_message(websocket, message, browser_clients, pi_client, processed_frames)
            except Exception as e:
                logger.error(f"Error handling WSL message: {e}")
                logger.error(traceback.format_exc())
    
    except websockets.exceptions.ConnectionClosedOK:
        logger.info(f"WSL processor disconnected normally")
    except Exception as e:
        logger.error(f"WSL processor error: {e}")
    finally:
        if wsl_processor == websocket:
            wsl_processor = None
            logger.info("WSL processor removed")

async def router(websocket):
    """Route WebSocket connections based on their path"""
    try:
        # Extract client info
        client_address = websocket.remote_address
        client_ip = client_address[0] if client_address else "unknown"
        
        # Try to get path in a way that's compatible with different websockets versions
        path = "/"
        try:
            # For newer versions
            if hasattr(websocket, 'path'):
                path = websocket.path
            # For older versions with request attribute
            elif hasattr(websocket, 'request') and websocket.request:
                path = websocket.request.path
            # Last resort - try headers
            elif hasattr(websocket, 'request_headers'):
                path = websocket.request_headers.get('URI', '/').split('?')[0]
        except Exception as path_error:
            logger.warning(f"Could not determine path: {path_error}")
        
        logger.info(f"New connection from {client_ip} on path: {path}")
        
        # Route based on path
        if "/browser" in path:
            await handle_browser_client(websocket)
        elif "/pi" in path:
            await handle_pi_client(websocket)
        elif "/wsl" in path:
            await handle_wsl_processor(websocket)
        else:
            logger.warning(f"Unknown connection path: {path}")
            await websocket.close(1008, "Unsupported endpoint")
    
    except Exception as e:
        logger.error(f"Error in connection router: {e}")
        logger.error(traceback.format_exc())
        try:
            await websocket.close(1011, "Internal server error")
        except:
            pass

async def start_server():
    """Start the WebSocket server"""
    host = config.SERVER_HOST
    port = config.SERVER_PORT
    
    logger.info(f"Starting server on {host}:{port}")
    
    # Start the server
    async with websockets.serve(
        router, 
        host, 
        port,
        ping_interval=20,
        ping_timeout=10,
        max_size=10*1024*1024,  # 10MB max message size
        max_queue=32            # Limit message queue to prevent memory issues
    ):
        logger.info(f"Server started successfully")
        
        # Signal handling for graceful shutdown
        loop = asyncio.get_running_loop()
        for signal_name in ('SIGINT', 'SIGTERM'):
            try:
                loop.add_signal_handler(
                    getattr(signal, signal_name),
                    lambda: asyncio.create_task(shutdown())
                )
            except:
                pass
        
        # Wait forever
        await asyncio.Future()

async def shutdown():
    """Perform a graceful shutdown"""
    logger.info("Shutting down server...")
    
    # Close all connections
    close_tasks = []
    
    # Close browser clients
    for client in browser_clients:
        try:
            close_tasks.append(asyncio.create_task(
                client.close(1001, "Server shutting down")
            ))
        except:
            pass
    
    # Close Pi client
    if pi_client:
        try:
            close_tasks.append(asyncio.create_task(
                pi_client.close(1001, "Server shutting down")
            ))
        except:
            pass
    
    # Close WSL processor
    if wsl_processor:
        try:
            close_tasks.append(asyncio.create_task(
                wsl_processor.close(1001, "Server shutting down")
            ))
        except:
            pass
    
    # Wait for all connections to close with a timeout
    if close_tasks:
        try:
            await asyncio.wait_for(asyncio.gather(*close_tasks, return_exceptions=True), timeout=2.0)
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for connections to close")
    
    # Exit
    logger.info("Server shutdown complete")
    os._exit(0)

if __name__ == "__main__":
    try:
        # Display startup info
        logger.info(f"A2 Server v{config.VERSION}")
        logger.info(f"Server will listen on {config.SERVER_HOST}:{config.SERVER_PORT}")
        
        # Run the server
        asyncio.run(start_server())
    except KeyboardInterrupt:
        logger.info("Server terminated by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        logger.error(traceback.format_exc())