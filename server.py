#!/usr/bin/env python3
"""
Simple HTTP server for the Search & Chat Interface
Run this script to serve the application locally
"""

import http.server
import socketserver
import webbrowser
import os
import sys

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        if self.path == '/login' or self.path == '/login/':
            self.path = '/login.html'
        elif self.path == '/' or self.path == '':
            self.path = '/index.html'
        
        return super().do_GET()

def main():
    port = 8000
    
    # Check if port is available
    try:
        with socketserver.TCPServer(("", port), CORSHTTPRequestHandler) as httpd:
            print(f"🚀 Server starting on http://localhost:{port}")
            print("📁 Serving files from:", os.getcwd())
            print("🌐 Opening browser...")
            
            # Open browser
            webbrowser.open(f'http://localhost:{port}')
            
            print("\n" + "="*50)
            print("Search & Chat Interface is running!")
            print("="*50)
            print("Press Ctrl+C to stop the server")
            print("="*50 + "\n")
            
            httpd.serve_forever()
            
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Port {port} is already in use. Trying port {port + 1}...")
            port += 1
            with socketserver.TCPServer(("", port), CORSHTTPRequestHandler) as httpd:
                print(f"🚀 Server starting on http://localhost:{port}")
                webbrowser.open(f'http://localhost:{port}')
                print("\n" + "="*50)
                print("Search & Chat Interface is running!")
                print("="*50)
                print("Press Ctrl+C to stop the server")
                print("="*50 + "\n")
                httpd.serve_forever()
        else:
            print(f"❌ Error starting server: {e}")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
        sys.exit(0)

if __name__ == "__main__":
    main()
