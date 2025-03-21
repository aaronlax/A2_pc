#!/usr/bin/env python3
import os
import glob
import subprocess
import datetime
import sys
import fnmatch
import logging
import math

# Import our custom logger configuration
try:
    # Add script directory to path to allow importing local modules
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(script_dir)
    from logger_config import setup_logger
except ImportError:
    # Fallback if logger_config.py is not available
    def setup_logger(name):
        logger = logging.getLogger(name)
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        return logger

# Set up logger
logger = setup_logger("CodebaseSummarizer")

try:
    from dotenv import load_dotenv
    from openai import OpenAI
except ImportError:
    logger.error("Missing required packages. Please run:")
    logger.error("python3 -m venv venv && source venv/bin/activate && pip install python-dotenv openai")
    sys.exit(1)

# Load environment variables from .env file
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.error("OPENAI_API_KEY not found in .env file")
    sys.exit(1)

# Initialize OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)

# Directory paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
LOGS_DIR = os.path.join(ROOT_DIR, "logs")
OUTPUTS_DIR = os.path.join(ROOT_DIR, "outputs")
SUMMARIES_DIR = os.path.join(OUTPUTS_DIR, "summaries")

# Create directories if they don't exist
for directory in [LOGS_DIR, OUTPUTS_DIR, SUMMARIES_DIR]:
    os.makedirs(directory, exist_ok=True)

# File patterns to include (add or modify as needed)
INCLUDE_PATTERNS = [
    "*.py",
    "*.md",
    "requirements.txt",
    "*.js",
    "*.jsx",
    "*.ts",
    "*.tsx",
    "*.html",
    "*.css",
    "*.scss",
    "*.json",
    "*.yaml",
    "*.yml",
    "client/**/*.py",
    "hardware/**/*.py",
    "server/**/*.py",
    "api/**/*.py",
    "config/**/*.py",
    "config/**/*.json",
    "config/**/*.yml",
    "config/**/*.yaml",
]

# Critical files that should always be included
CRITICAL_FILES = [
    "requirements.txt",
    "README.md",
    "server.py",
    "main.py",
    "app.py",
    "api.py",
    "config.py",
    "package.json"
]

# Files or directories to exclude
EXCLUDE_PATHS = [
    "venv/",
    "__pycache__/",
    ".git/",
    "outputs/",
    "logs/",
]

# Read additional exclusion patterns from file if it exists
EXCLUDE_PATTERNS_FILE = os.path.join(SCRIPT_DIR, "exclude_patterns.txt")
if os.path.exists(EXCLUDE_PATTERNS_FILE):
    logger.info(f"Reading exclusion patterns from {EXCLUDE_PATTERNS_FILE}")
    with open(EXCLUDE_PATTERNS_FILE, 'r') as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if line and not line.startswith('#'):
                if line not in EXCLUDE_PATHS:
                    EXCLUDE_PATHS.append(line)
    logger.info(f"Total exclusion patterns: {len(EXCLUDE_PATHS)}")

def should_include(file_path):
    """Check if file should be included based on exclusion rules"""
    # Normalize path for consistent pattern matching
    normalized_path = file_path.replace('\\', '/')
    if normalized_path.startswith('./'):
        normalized_path = normalized_path[2:]
    
    for exclude in EXCLUDE_PATHS:
        # Skip empty patterns
        if not exclude:
            continue
            
        # Normalize exclude pattern
        exclude_pattern = exclude.replace('\\', '/')
        
        # Check if it's a directory pattern ending with /
        if exclude_pattern.endswith('/'):
            if normalized_path.startswith(exclude_pattern) or f"/{exclude_pattern}" in normalized_path:
                logger.debug(f"Excluding {file_path} (matches directory pattern {exclude_pattern})")
                return False
        # Check if it's a glob pattern
        elif any(c in exclude_pattern for c in '*?[]'):
            if fnmatch.fnmatch(normalized_path, exclude_pattern):
                logger.debug(f"Excluding {file_path} (matches glob pattern {exclude_pattern})")
                return False
        # Simple substring match for specific files/extensions
        elif exclude_pattern in normalized_path:
            logger.debug(f"Excluding {file_path} (contains {exclude_pattern})")
            return False
    
    return True

def get_files_to_concatenate():
    """Get all files matching the include patterns and not in excluded directories"""
    all_files = []
    
    # Switch to the root directory
    os.chdir(ROOT_DIR)
    
    # First, add critical files that should always be included if they exist
    for critical_file in CRITICAL_FILES:
        if os.path.exists(critical_file) and should_include(critical_file):
            all_files.append(critical_file)
            logger.info(f"Including critical file: {critical_file}")
    
    # First get all files from root directory matching our patterns
    for pattern in INCLUDE_PATTERNS:
        if '*' in pattern and '/' not in pattern:  # Non-recursive patterns
            files = glob.glob(pattern)
            included_files = [f for f in files if should_include(f) and f not in all_files]
            if included_files:
                logger.info(f"Including {len(included_files)} files matching pattern: {pattern}")
                all_files.extend(included_files)
    
    # Then walk through directories recursively
    for root, dirs, files in os.walk('.'):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if not any(exclude in os.path.join(root, d) for exclude in EXCLUDE_PATHS)]
        
        for file in files:
            file_path = os.path.join(root, file)
            if file_path not in all_files and should_include(file_path):
                # Check if file matches any of our patterns
                for pattern in INCLUDE_PATTERNS:
                    if ('/' in pattern and fnmatch.fnmatch(file_path, pattern)) or \
                       (fnmatch.fnmatch(file, pattern.split('/')[-1])):
                        all_files.append(file_path)
                        break
    
    # Sort files by importance (critical files first, then by path)
    def sort_key(file_path):
        # Extract just the filename
        filename = os.path.basename(file_path)
        # Critical files are prioritized
        if filename in CRITICAL_FILES:
            return (0, CRITICAL_FILES.index(filename))
        return (1, file_path)
    
    sorted_files = sorted(list(set(all_files)), key=sort_key)
    
    # Log the list of files being included
    logger.info(f"Including a total of {len(sorted_files)} files in the codebase summary")
    for file in sorted_files[:10]:  # Log the first 10 files
        logger.info(f" - {file}")
    if len(sorted_files) > 10:
        logger.info(f" - ... and {len(sorted_files) - 10} more files")
    
    return sorted_files

def create_file_entries(files):
    """Create file entries for each file to be processed"""
    file_entries = []
    
    total_size = 0
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Skip empty files
                if not content.strip():
                    continue
                    
                size = len(content)
                total_size += size
                
                file_entries.append({
                    'path': file_path,
                    'content': content,
                    'size': size
                })
        except Exception as e:
            logger.error(f"Error reading {file_path}: {str(e)}")
    
    logger.info(f"Total size of all files: {total_size} characters")
    return file_entries, total_size

def chunk_files(file_entries, max_chunk_size=40000):
    """Divide files into chunks to avoid token limits"""
    chunks = []
    current_chunk = []
    current_size = 0
    
    # First, add all small files
    small_files = [f for f in file_entries if f['size'] < max_chunk_size / 4]
    for file in small_files:
        if current_size + file['size'] > max_chunk_size:
            chunks.append(current_chunk)
            current_chunk = []
            current_size = 0
        
        current_chunk.append(file)
        current_size += file['size']
    
    # If we have files in the current chunk, add it
    if current_chunk:
        chunks.append(current_chunk)
    
    # Now handle larger files individually
    large_files = [f for f in file_entries if f['size'] >= max_chunk_size / 4]
    for file in large_files:
        # If the file is too large, we'll need to split it
        if file['size'] > max_chunk_size:
            logger.info(f"File {file['path']} is too large, will be split")
            content = file['content']
            for i in range(0, len(content), max_chunk_size):
                chunk_content = content[i:i+max_chunk_size]
                chunks.append([{
                    'path': f"{file['path']} (part {i//max_chunk_size + 1})",
                    'content': chunk_content,
                    'size': len(chunk_content)
                }])
        else:
            chunks.append([file])
    
    logger.info(f"Split files into {len(chunks)} chunks")
    return chunks

def create_concatenated_text(file_entries):
    """Concatenate files into text with headers"""
    output = []
    
    # Add timestamp and summary header
    output.append(f"# Files in this chunk - {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output.append(f"Total files: {len(file_entries)}\n")
    
    for entry in file_entries:
        output.append(f"\n\n{'='*80}")
        output.append(f"FILE: {entry['path']}")
        output.append(f"{'='*80}\n")
        output.append(entry['content'])
    
    return "\n".join(output)

def generate_chunk_summary(content, project_name):
    """Generate a summary for a chunk of the codebase"""
    system_prompt = f"""You are analyzing a chunk of the codebase for project "{project_name}".
    Generate a concise summary of this chunk, focusing on:
    
    1. Main functionality and purpose of the files
    2. Key components and their relationships
    3. Important APIs, functions, or classes
    4. Configuration details
    
    Format your response as bullet points with clear headings for each major component or topic.
    Focus on facts only - do not make assumptions about functionality that isn't clear from the code.
    """
    
    try:
        logger.info("Calling OpenAI API for chunk summary generation")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo-16k",  # Using a more cost-effective model for chunks
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content}
            ],
            max_tokens=1500,
            temperature=0.3
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error generating chunk summary: {str(e)}")
        return f"Error generating chunk summary: {str(e)}"

def generate_final_summary(chunk_summaries, project_name):
    """Generate a final summary by combining chunk summaries"""
    system_prompt = f"""You are creating a comprehensive README for the "{project_name}" project.
    Based on the summaries of different parts of the codebase provided, create a well-structured README that includes:
    
    1. A clear project overview and purpose
    2. Main components and their relationships
    3. Setup and installation instructions
    4. Usage examples
    5. API documentation (if applicable)
    6. Configuration options
    
    Format your response as a clean, professional markdown document.
    Focus on facts present in the summaries - do not make assumptions about functionality that isn't mentioned.
    """
    
    all_summaries = "\n\n===== NEXT CHUNK =====\n\n".join(chunk_summaries)
    
    try:
        logger.info("Calling OpenAI API for final summary generation")
        response = client.chat.completions.create(
            model="gpt-4-turbo",  # Using GPT-4 for the final summary for quality
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": all_summaries}
            ],
            max_tokens=2000,
            temperature=0.5
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error generating final summary: {str(e)}")
        return f"Error generating final summary: {str(e)}"

def update_readme(summary, project_name):
    """Create or update the README.md file with the generated summary"""
    readme_path = os.path.join(ROOT_DIR, "README.md")
    
    # Add timestamp and header
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    readme_content = f"""# {project_name}

{summary}

---
*This README was automatically generated on {timestamp}*
"""
    
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(readme_content)
    
    return readme_path

def main():
    # Get project name from environment variable or use default
    project_name = os.getenv("PROJECT_NAME", os.path.basename(os.path.abspath(ROOT_DIR)))
    
    logger.info(f"Starting codebase summarization for project: {project_name}")
    
    # Get files to concatenate
    files = get_files_to_concatenate()
    logger.info(f"Found {len(files)} files to process")
    
    # Create file entries with content and size
    file_entries, total_size = create_file_entries(files)
    logger.info(f"Processed {len(file_entries)} non-empty files")
    
    # Save a full concatenated version for reference
    date_str = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    all_content = create_concatenated_text(file_entries)
    concat_filename = os.path.join(SUMMARIES_DIR, f"concatenated_codebase_{date_str}.txt")
    with open(concat_filename, 'w', encoding='utf-8') as f:
        f.write(all_content)
    logger.info(f"Concatenated content saved to {concat_filename}")
    
    # Chunk files if necessary
    chunks = chunk_files(file_entries)
    
    # Generate summaries for each chunk
    chunk_summaries = []
    for i, chunk in enumerate(chunks):
        logger.info(f"Processing chunk {i+1}/{len(chunks)} with {len(chunk)} files")
        chunk_text = create_concatenated_text(chunk)
        
        # Save chunk for debugging if needed
        chunk_filename = os.path.join(SUMMARIES_DIR, f"chunk_{i+1}_{date_str}.txt")
        with open(chunk_filename, 'w', encoding='utf-8') as f:
            f.write(chunk_text)
        
        # Generate summary for this chunk
        chunk_summary = generate_chunk_summary(chunk_text, project_name)
        chunk_summaries.append(chunk_summary)
        
        # Save chunk summary
        summary_filename = os.path.join(SUMMARIES_DIR, f"chunk_summary_{i+1}_{date_str}.md")
        with open(summary_filename, 'w', encoding='utf-8') as f:
            f.write(chunk_summary)
    
    # Generate final summary
    logger.info("Generating final summary...")
    final_summary = generate_final_summary(chunk_summaries, project_name)
    
    # Update README.md
    logger.info("Updating README.md...")
    update_readme(final_summary, project_name)
    
    # Save final summary
    output_filename = os.path.join(SUMMARIES_DIR, f"codebase_summary_{date_str}.md")
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write(final_summary)
    
    logger.info(f"Process complete. README.md has been updated with a summary of the codebase")
    logger.info(f"Final summary saved to {output_filename}")

if __name__ == "__main__":
    main() 