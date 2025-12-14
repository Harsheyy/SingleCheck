from http.server import BaseHTTPRequestHandler
import sys
import os

# Add project root to sys.path so we can import from src
# In Vercel, the root is usually the current working directory
sys.path.append(os.getcwd())

# Also try adding parent directories just in case
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

try:
    from src.fetch_listings import sync_opensea_originals, sync_tokenworks, sync_editions, fetch_best_offers_for_collection
except ImportError as e:
    print(f"ImportError: {e}")
    # This might happen if paths are tricky, but adding os.getcwd() usually fixes it on Vercel
    pass

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # Re-import inside handler to ensure path is set if it wasn't before
            from src.fetch_listings import sync_opensea_originals, sync_tokenworks, sync_editions, fetch_best_offers_for_collection
            
            ORIGINALS_TABLE = "vv_checks_listings"
            ORIGINALS_COLLECTION_SLUG = "vv-checks-originals"
            print("Starting sync_listings cron...")
            
            # Fetch offers once for Originals
            try:
                print(f"[cron] Fetching offers for {ORIGINALS_COLLECTION_SLUG}...")
                originals_offers_map = fetch_best_offers_for_collection(ORIGINALS_COLLECTION_SLUG)
            except Exception as e:
                print(f"[cron] Error fetching offers: {e}")
                originals_offers_map = {}
            
            # 1) OpenSea Originals -> shared table
            sync_opensea_originals(ORIGINALS_TABLE, offers_map=originals_offers_map)
            
            # 2) TokenWorks Originals -> same table
            sync_tokenworks(ORIGINALS_TABLE, offers_map=originals_offers_map)
            
            # 3) Editions stay separate
            sync_editions("vv_editions_listings")
            
            self.send_response(200)
            self.end_headers()
            self.wfile.write('Sync listings completed successfully'.encode('utf-8'))
        except Exception as e:
            print(f"Error in sync_listings: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f'Error: {str(e)}'.encode('utf-8'))
