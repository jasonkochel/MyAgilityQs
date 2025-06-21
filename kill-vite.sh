#!/usr/bin/bash

# Kill any processes running on port 5174 (Vite dev server default)
echo "Checking for processes on port 5174..."

# Find and kill processes using port 5174
PIDS=$(lsof -ti:5174)

if [ -z "$PIDS" ]; then
    echo "No processes found running on port 5174"
else
    echo "Found processes on port 5174: $PIDS"
    echo "Killing processes..."
    kill -9 $PIDS
    echo "Processes killed successfully"
fi

# Also kill any vite processes by name (in case they're running on different ports)
echo "Checking for vite processes..."
VITE_PIDS=$(pgrep -f "vite")

if [ -z "$VITE_PIDS" ]; then
    echo "No vite processes found"
else
    echo "Found vite processes: $VITE_PIDS"
    echo "Killing vite processes..."
    pkill -f "vite"
    echo "Vite processes killed successfully"
fi

echo "Done! Port 5174 should now be available for Vite dev server"