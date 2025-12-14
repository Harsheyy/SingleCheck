import os
from decimal import Decimal
from typing import List, Dict, Any, Set, Optional
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from web3 import Web3

load_dotenv()

OPENSEA_API_KEY = os.getenv("OPENSEA_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
ALCHEMY_API_KEY = os.getenv("ALCHEMY_API_KEY")
ALCHEMY_RPC_URL = os.getenv("ALCHEMY_RPC_URL")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
w3 = Web3(Web3.HTTPProvider(ALCHEMY_RPC_URL))

# Contracts
CHECKS_EDITIONS_CONTRACT = os.getenv("CHECKS_EDITIONS_CONTRACT")
CHECKS_ORIGINALS_CONTRACT = os.getenv("CHECKS_ORIGINALS_CONTRACT")
TOKENWORKS_ADDRESS = os.getenv("TOKENWORKS_ADDRESS")

# OpenSea base
OPENSEA_BASE = "https://api.opensea.io/api/v2/listings/collection"

# Alchemy base
ALCHEMY_BASE_URL = f"https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}"

# Minimal ABI for TokenWorks.nftForSale(uint256) -> uint256
TOKENWORKS_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "nftForSale",
        "outputs": [{"internalType": "uint256", "name": "priceWei", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    }
]

tokenworks_contract = w3.eth.contract(
    address=Web3.to_checksum_address(TOKENWORKS_ADDRESS),
    abi=TOKENWORKS_ABI,
)


def wei_to_eth(wei: str | int) -> str:
    """Convert wei -> ETH string with good precision."""
    return str(Decimal(str(wei)) / Decimal(10**18))


def fetch_best_offer_eth(collection_slug: str, token_id: str) -> str | None:
    headers = {"accept": "*/*", "x-api-key": OPENSEA_API_KEY}
    url = f"https://api.opensea.io/api/v2/offers/collection/{collection_slug}/nfts/{token_id}/best"
    try:
        res = requests.get(url, headers=headers, timeout=15)
        if res.status_code == 404:
            return None
        res.raise_for_status()
        data = res.json()
    except Exception:
        return None

    obj = data.get("offer") or data
    price_obj = obj.get("price") if isinstance(obj, dict) else None
    wei = price_obj.get("value") if isinstance(price_obj, dict) else None
    if wei is None:
        return None
    return wei_to_eth(wei)


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------
def get_existing_token_ids(table_name: str, source: str | None = None) -> Set[str]:
    """
    Fetch current token_ids in a Supabase table (optionally per-source).
    Used to detect which ones disappeared.
    """
    query = supabase.table(table_name).select("token_id")
    if source is not None:
        query = query.eq("source", source)
    resp = query.execute()
    rows = resp.data or []
    return {str(row["token_id"]) for row in rows}


def batch_upsert(table_name: str, data: List[Dict[str, Any]], batch_size: int = 100) -> None:
    """
    Upsert data in batches to Supabase.
    """
    if not data:
        return
        
    for i in range(0, len(data), batch_size):
        batch = data[i : i + batch_size]
        supabase.table(table_name).upsert(
            batch,
            on_conflict="token_id",
        ).execute()


def delete_stale_tokens(
    table_name: str, 
    current_ids: Set[str], 
    source: str | None = None, 
    batch_size: int = 100
) -> int:
    """
    Delete tokens from DB that are not in current_ids.
    Returns number of deleted tokens.
    """
    existing_ids = get_existing_token_ids(table_name, source=source)
    to_delete = list(existing_ids - current_ids)
    
    if not to_delete:
        return 0

    for i in range(0, len(to_delete), batch_size):
        chunk = to_delete[i : i + batch_size]
        query = supabase.table(table_name).delete().in_("token_id", chunk)
        if source is not None:
            query = query.eq("source", source)
        query.execute()
            
    return len(to_delete)


# ---------------------------------------------------------
# OpenSea: fetch listings for a collection (by slug)
# ---------------------------------------------------------
def fetch_all_listings_for_collection(
    collection_slug: str,
) -> List[Dict[str, Any]]:
    """
    Fetch all listings from OpenSea for a given collection slug.
    Returns a list of dicts with token_id, price_eth, and owner.
    """
    base_url = f"{OPENSEA_BASE}/{collection_slug}/best"

    headers = {
        "accept": "*/*",
        "x-api-key": OPENSEA_API_KEY,
    }

    listings: List[Dict[str, Any]] = []
    next_cursor = None

    while True:
        url = base_url
        if next_cursor:
            url += f"?next={next_cursor}"

        try:
            res = requests.get(url, headers=headers, timeout=20)
            if res.status_code == 404:
                return []
            res.raise_for_status()
            data = res.json()
        except Exception as e:
            print(f"Error fetching listings for {collection_slug}: {e}")
            break

        for item in data.get("listings", []):
            params = item.get("protocol_data", {}).get("parameters", {})
            offer = params.get("offer", [])
            token_id = offer[0].get("identifierOrCriteria") if offer else None
            wei_price = item.get("price", {}).get("current", {}).get("value")
            eth_price = wei_to_eth(wei_price) if wei_price is not None else None
            owner = params.get("offerer")

            if token_id is None or eth_price is None:
                continue

            listings.append(
                {
                    "token_id": str(token_id),
                    "price_eth": eth_price,
                    "owner": owner,
                }
            )

        next_cursor = data.get("next")
        if not next_cursor:
            break

    return listings


def reduce_to_floor_per_token(
    listings: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    If a token has multiple listings, keep the *lowest* price_eth.
    Returns a list where each token_id appears at most once.
    """
    floors: Dict[str, Dict[str, Any]] = {}

    for l in listings:
        token_id = l["token_id"]
        price = Decimal(l["price_eth"])

        if token_id not in floors:
            floors[token_id] = l
        else:
            existing_price = Decimal(floors[token_id]["price_eth"])
            if price < existing_price:
                floors[token_id] = l

    return list(floors.values())


# ---------------------------------------------------------
# Sync Logic
# ---------------------------------------------------------
def sync_opensea_collection(
    collection_slug: str, 
    table_name: str, 
    source: str | None = None
) -> None:
    """
    Generic sync for OpenSea collections.
    Fetches listings, reduces to floor, fetches best offers (concurrently),
    upserts to DB, and deletes stale tokens.
    """
    listings = fetch_all_listings_for_collection(collection_slug)
    floor_listings = reduce_to_floor_per_token(listings)
    
    print(f"[{collection_slug}] Processing {len(floor_listings)} listings...")
    
    # Concurrently fetch best offers
    offers_set = 0
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_token = {
            executor.submit(fetch_best_offer_eth, collection_slug, row["token_id"]): row 
            for row in floor_listings
        }
        
        for future in as_completed(future_to_token):
            row = future_to_token[future]
            try:
                ho = future.result()
                if ho is not None:
                    row["highest_offer_eth"] = ho
                    offers_set += 1
            except Exception as exc:
                print(f"[{collection_slug}] Error fetching offer for token {row['token_id']}: {exc}")

    now_ts = datetime.now(timezone.utc).isoformat()

    # Prepare batch
    for row in floor_listings:
        row["last_seen_at"] = now_ts
        if source:
            row["source"] = source

    # Upsert
    batch_upsert(table_name, floor_listings)
    print(f"[{collection_slug}] Highest offers set: {offers_set}")

    # Delete stale
    current_ids = {l["token_id"] for l in floor_listings}
    deleted_count = delete_stale_tokens(table_name, current_ids, source=source)
    
    if deleted_count > 0:
        print(f"[{collection_slug}] Deleted stale tokens: {deleted_count}")
    else:
        print(f"[{collection_slug}] No stale tokens to delete")


def sync_tokenworks(table_name: str) -> None:
    """
    Sync TokenWorks listings into vv_checks_listings with source='tokenworks'.
    """
    listings = fetch_tokenworks_listings(table_name)
    
    print(f"[tokenworks] Processing {len(listings)} listings (skipping offers)...")
    
    now_ts = datetime.now(timezone.utc).isoformat()
    
    # Prepare batch
    for row in listings:
        row["highest_offer_eth"] = None # Explicitly clear offers
        row["last_seen_at"] = now_ts
        row["source"] = "tokenworks"

    # Upsert
    batch_upsert(table_name, listings)
    print(f"[tokenworks] Upserted listings: {len(listings)}")

    # Delete stale
    current_ids = {l["token_id"] for l in listings}
    deleted_count = delete_stale_tokens(table_name, current_ids, source="tokenworks")
    
    if deleted_count > 0:
        print(f"[tokenworks] Deleted stale tokens: {deleted_count}")
    else:
        print(f"[tokenworks] No stale tokens to delete")


def fetch_tokenworks_check_token_ids() -> List[str]:
    """
    Use Alchemy getNFTs to fetch all Checks Originals owned by TokenWorks.
    """
    token_ids: List[str] = []
    page_key = None

    while True:
        params = {
            "owner": TOKENWORKS_ADDRESS,
            "contractAddresses[]": CHECKS_ORIGINALS_CONTRACT,
            "withMetadata": "false",
        }
        if page_key:
            params["pageKey"] = page_key

        url = f"{ALCHEMY_BASE_URL}/getNFTs"
        try:
            resp = requests.get(url, params=params, timeout=20)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
             print(f"[tokenworks] Error fetching NFTs: {e}")
             break

        for nft in data.get("ownedNfts", []):
            raw_id = nft["id"]["tokenId"]  # hex string like "0x1234"
            token_id_int = int(raw_id, 16)
            token_ids.append(str(token_id_int))

        page_key = data.get("pageKey")
        if not page_key:
            break

    return token_ids


def fetch_tokenworks_listings(table_name: str) -> List[Dict[str, Any]]:
    """
    Fetch TokenWorks listings, using cached prices if available.
    """
    token_ids = fetch_tokenworks_check_token_ids()
    listings: List[Dict[str, Any]] = []

    # 1) Fetch existing cached prices to minimize RPC calls
    try:
        resp = (
            supabase.table(table_name)
            .select("token_id, price_eth")
            .eq("source", "tokenworks")
            .execute()
        )
        db_rows = resp.data or []
        db_map = {str(row["token_id"]): row["price_eth"] for row in db_rows}
    except Exception as e:
        print(f"[tokenworks] Error fetching existing rows: {e}")
        db_map = {}

    print(f"[tokenworks] Found {len(token_ids)} owned tokens. Checking prices...")

    for token_id in token_ids:
        # Check cache first
        cached_price = db_map.get(token_id)
        
        if cached_price is not None:
            listings.append(
                {
                    "token_id": token_id,
                    "price_eth": cached_price,
                    "owner": TOKENWORKS_ADDRESS,
                }
            )
            continue

        # Otherwise, check on-chain
        tid_int = int(token_id)
        try:
            price_wei = tokenworks_contract.functions.nftForSale(tid_int).call()
        except Exception:
            continue

        # 0 = not for sale
        if price_wei is None or int(price_wei) == 0:
            continue

        price_eth = wei_to_eth(price_wei)

        listings.append(
            {
                "token_id": token_id,
                "price_eth": price_eth,
                "owner": TOKENWORKS_ADDRESS,
            }
        )

    return listings


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------
# Expose the old function names for backward compatibility if needed, 
# or just wrap the new generic one.
def sync_opensea_originals(table_name: str) -> None:
    sync_opensea_collection("vv-checks-originals", table_name, source="opensea")

def sync_editions(table_name: str) -> None:
    sync_opensea_collection("vv-checks", table_name, source=None)

if __name__ == "__main__":
    ORIGINALS_TABLE = "vv_checks_listings"

    # 1) OpenSea Originals -> shared table
    sync_opensea_originals(ORIGINALS_TABLE)

    # 2) TokenWorks Originals -> same table
    sync_tokenworks(ORIGINALS_TABLE)

    # 3) Editions stay separate
    sync_editions("vv_editions_listings")

    print("\nAll syncs completed ✅")
