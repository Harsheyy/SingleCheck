from http.server import BaseHTTPRequestHandler
import sys
import os

# Add project root to sys.path
sys.path.append(os.getcwd())
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

try:
    from src.token_meta import enrich_originals_with_metadata, enrich_editions_with_metadata
except ImportError as e:
    print(f"ImportError: {e}")
    pass

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            from src.token_meta import enrich_originals_with_metadata, enrich_editions_with_metadata
            
            print("Starting sync_metadata cron...")
            enrich_originals_with_metadata()
            enrich_editions_with_metadata()
            
            self.send_response(200)
            self.end_headers()
            self.wfile.write('Sync metadata completed successfully'.encode('utf-8'))
        except Exception as e:
            print(f"Error in sync_metadata: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f'Error: {str(e)}'.encode('utf-8'))
