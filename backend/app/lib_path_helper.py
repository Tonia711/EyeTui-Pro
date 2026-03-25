"""
Helper module for auto-detecting and setting library paths
Supports cross-platform (macOS, Linux, Windows)
No need to manually set environment variables
"""
import os
import sys
import platform
from pathlib import Path


def setup_library_paths():
    """
    Auto-detect and set ZBar and libdmtx library paths
    Supports macOS (Apple Silicon & Intel), Linux, Windows
    """
    system = platform.system()
    lib_paths = []
    
    if system == "Darwin":  # macOS
        # Check common Homebrew installation locations
        possible_paths = [
            "/opt/homebrew/lib",                    # Apple Silicon Homebrew
            "/usr/local/lib",                       # Intel Mac Homebrew
            "/opt/homebrew/opt/zbar/lib",          # Homebrew zbar specific path
            "/opt/homebrew/opt/libdmtx/lib",       # Homebrew libdmtx specific path
            "/usr/local/opt/zbar/lib",             # Intel Mac zbar
            "/usr/local/opt/libdmtx/lib",          # Intel Mac libdmtx
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                lib_paths.append(path)
                # Check if actual library files exist
                lib_files = list(Path(path).glob("libzbar*.dylib"))
                if lib_files:
                    print(f"[LIB PATH] Found ZBar library at: {path}")
        
        if lib_paths:
            # Set DYLD_LIBRARY_PATH (macOS dynamic library path)
            current_dyld = os.environ.get("DYLD_LIBRARY_PATH", "")
            new_path = ":".join(lib_paths)
            if current_dyld:
                os.environ["DYLD_LIBRARY_PATH"] = f"{new_path}:{current_dyld}"
            else:
                os.environ["DYLD_LIBRARY_PATH"] = new_path
            
            # Set LIBRARY_PATH (compile-time library path)
            current_lib = os.environ.get("LIBRARY_PATH", "")
            if current_lib:
                os.environ["LIBRARY_PATH"] = f"{new_path}:{current_lib}"
            else:
                os.environ["LIBRARY_PATH"] = new_path
            
            print(f"[LIB PATH] Auto-configured library paths: {new_path}")
            return True
    
    elif system == "Linux":
        # Linux typically uses standard library paths, but check common locations
        possible_paths = [
            "/usr/lib",
            "/usr/local/lib",
            "/usr/lib/x86_64-linux-gnu",
            "/usr/lib/aarch64-linux-gnu",  # ARM64 Linux
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                lib_paths.append(path)
                # Check if actual library files exist
                lib_files = list(Path(path).glob("libzbar.so*"))
                if lib_files:
                    print(f"[LIB PATH] Found ZBar library at: {path}")
        
        if lib_paths:
            current_ld = os.environ.get("LD_LIBRARY_PATH", "")
            new_path = ":".join(lib_paths)
            if current_ld:
                os.environ["LD_LIBRARY_PATH"] = f"{new_path}:{current_ld}"
            else:
                os.environ["LD_LIBRARY_PATH"] = new_path
            
            print(f"[LIB PATH] Auto-configured library paths: {new_path}")
            return True
    
    elif system == "Windows":
        # Windows uses PATH to find DLLs
        possible_paths = [
            "C:\\Program Files\\ZBar\\bin",
            "C:\\zbar\\bin",
            "C:\\Program Files (x86)\\ZBar\\bin",
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                lib_paths.append(path)
                # Check if actual DLL files exist
                dll_files = list(Path(path).glob("libzbar*.dll"))
                if dll_files:
                    print(f"[LIB PATH] Found ZBar library at: {path}")
        
        if lib_paths:
            current_path = os.environ.get("PATH", "")
            new_path = ";".join(lib_paths)
            if current_path:
                os.environ["PATH"] = f"{new_path};{current_path}"
            else:
                os.environ["PATH"] = new_path
            
            print(f"[LIB PATH] Auto-configured library paths: {new_path}")
            return True
    
    # If no library paths found, print warning but don't error
    print(f"[LIB PATH] No library paths found for {system}. pyzbar may not work.")
    print(f"[LIB PATH] Please install ZBar: brew install zbar (macOS) or apt-get install libzbar0 (Linux)")
    return False


# Auto-execute on module import
if __name__ != "__main__":
    setup_library_paths()
