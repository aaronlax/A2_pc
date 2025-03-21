"""
Logger configuration for all project scripts.
This ensures logs are stored in the correct directory.
"""

import os
import logging
import datetime
from logging.handlers import RotatingFileHandler

def setup_logger(name, log_file=None, level=logging.INFO):
    """
    Set up a logger with consistent formatting and file handling
    
    Args:
        name: Logger name
        log_file: Log file name (if None, uses [name]_log.txt)
        level: Logging level
        
    Returns:
        Configured logger instance
    """
    # Determine script directory and project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    logs_dir = os.path.join(root_dir, "logs")
    
    # Create logs directory if it doesn't exist
    os.makedirs(logs_dir, exist_ok=True)
    
    # Set up default log file if not provided
    if log_file is None:
        log_file = f"{name.lower().replace(' ', '_')}_log.txt"
    
    # Create full path to log file
    log_path = os.path.join(logs_dir, log_file)
    
    # Set up logger
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Clear any existing handlers
    if logger.hasHandlers():
        logger.handlers.clear()
    
    # Create file handler with rotation (10MB max size, up to 5 backup files)
    file_handler = RotatingFileHandler(
        log_path, 
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    
    # Create console handler
    console_handler = logging.StreamHandler()
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Set formatter for handlers
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # Add handlers to logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

# Example usage
if __name__ == "__main__":
    # Create a test logger
    logger = setup_logger("TestLogger")
    
    # Log some test messages
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    logger.critical("This is a critical message") 