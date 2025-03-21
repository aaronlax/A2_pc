# PowerShell script to run the update_readme.py in the correct virtual environment

# Navigate to the project root directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
Set-Location -Path $RootDir

# Set environment variables if needed
$env:EXCLUDE_PATTERNS_FILE = "$ScriptDir\exclude_patterns.txt"
# Set a project name (used in the README)
$ProjectName = (Get-Item -Path $RootDir).Name
$env:PROJECT_NAME = $ProjectName

# Check if .env file exists, create if not
if (-not (Test-Path -Path ".env")) {
    Write-Host "Creating .env file..."
    if (-not $env:OPENAI_API_KEY) {
        $ApiKey = Read-Host "Please enter your OpenAI API key"
        "OPENAI_API_KEY=$ApiKey" | Out-File -FilePath ".env" -Encoding utf8
    } else {
        "OPENAI_API_KEY=$env:OPENAI_API_KEY" | Out-File -FilePath ".env" -Encoding utf8
    }
}

# Check if virtual environment exists, create if not
if (-not (Test-Path -Path "venv")) {
    Write-Host "Creating virtual environment..."
    try {
        python -m venv venv
        & .\venv\Scripts\Activate.ps1
        Write-Host "Installing required packages..."
        pip install python-dotenv openai
    } catch {
        Write-Host "Error creating virtual environment: $_" -ForegroundColor Red
        exit 1
    }
} else {
    & .\venv\Scripts\Activate.ps1
}

# Create necessary directories if they don't exist
if (-not (Test-Path -Path "logs")) { New-Item -Path "logs" -ItemType Directory }
if (-not (Test-Path -Path "outputs\summaries")) { New-Item -Path "outputs\summaries" -ItemType Directory -Force }

# Run the script
Write-Host "Generating codebase summary for $ProjectName..."
try {
    python scripts\update_readme.py
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error running script (exit code $LASTEXITCODE)" -ForegroundColor Red
    } else {
        Write-Host "Codebase summary update complete!" -ForegroundColor Green
        if (Test-Path -Path "README.md") {
            Write-Host "Updated README.md file. You may want to review it."
        }
    }
} catch {
    Write-Host "Error running script: $_" -ForegroundColor Red
}

# Exit the virtual environment
deactivate