#!/bin/bash
# Start SKYNT Miners
# This script launches both Python and Rust miners in parallel

echo "========================================"
echo "Starting SKYNT Miners"
echo "========================================"

# Function to check if dependencies are installed
check_dependencies() {
    echo "Checking dependencies..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo "Error: Python 3 is not installed"
        exit 1
    fi
    
    # Check Cargo (Rust)
    if ! command -v cargo &> /dev/null; then
        echo "Error: Cargo (Rust) is not installed"
        exit 1
    fi
    
    echo "✓ All dependencies found"
}

# Function to start Python miner
start_python_miner() {
    echo ""
    echo "Starting Python miner..."
    cd miners/python-miner
    python3 miner.py &
    PYTHON_PID=$!
    echo "Python miner started (PID: $PYTHON_PID)"
    cd ../..
}

# Function to start Rust miner
start_rust_miner() {
    echo ""
    echo "Starting Rust miner..."
    cd miners/rust-miner
    cargo run --release &
    RUST_PID=$!
    echo "Rust miner started (PID: $RUST_PID)"
    cd ../..
}

# Main execution
check_dependencies

# Start miners
start_python_miner
start_rust_miner

echo ""
echo "========================================"
echo "Both miners are running"
echo "Python miner PID: $PYTHON_PID"
echo "Rust miner PID: $RUST_PID"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop all miners"

# Wait for user interrupt
trap "echo 'Stopping miners...'; kill $PYTHON_PID $RUST_PID 2>/dev/null; exit" INT TERM

# Wait for both processes
wait
