# Server configuration
VERSION = "1.0.0"
SERVER_HOST = "0.0.0.0"  # Listen on all interfaces
SERVER_PORT = 5000

# Video settings
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
JPEG_QUALITY = 75
MAX_FPS = 30
FRAME_SKIP = 2  # Process every Nth frame

# ML settings
DETECTION_CONFIDENCE = 0.5
USE_GPU = True