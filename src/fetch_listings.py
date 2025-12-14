import os
from decimal import Decimal
from typing import List, Dict, Any, Set
from datetime import datetime, timezone

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
    return {row["token_id"] for row in rows}


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

        res = requests.get(url, headers=headers, timeout=20)
        if res.status_code == 404:
            return []
        res.raise_for_status()
        data = res.json()

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
                    "token_id": token_id,
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
# Sync OpenSea Originals -> vv_checks_listings
# ---------------------------------------------------------
def sync_opensea_originals(table_name: str) -> None:
    collection_slug = "vv-checks-originals"
    source = "opensea"

    listings = fetch_all_listings_for_collection(collection_slug)
    floor_listings = reduce_to_floor_per_token(listings)
    
    print(f"[originals] Processing {len(floor_listings)} listings...")
    offers_set = 0
    
    for row in floor_listings:
        tid = row["token_id"]
        
        # Always fetch individual offer
        ho = fetch_best_offer_eth(collection_slug, tid)
        if ho is not None:
            row["highest_offer_eth"] = ho
            offers_set += 1

    batch_size = 100
    now_ts = datetime.now(timezone.utc).isoformat()


    # Upsert: if token existed (maybe from older OpenSea listing), update it.
    for i in range(0, len(floor_listings), batch_size):
        batch = floor_listings[i : i + batch_size]
        for row in batch:
            row["last_seen_at"] = now_ts
            row["source"] = source

        supabase.table(table_name).upsert(
            batch,
            on_conflict="token_id",  # single PK
        ).execute()

    print(f"[originals] Highest offers set: {offers_set}")

    # Delete tokens that are no longer listed on OpenSea *and* currently have source='opensea'
    current_token_ids = {l["token_id"] for l in floor_listings}
    existing_opensea_ids = get_existing_token_ids(table_name, source="opensea")

    to_delete = list(existing_opensea_ids - current_token_ids)

    if to_delete:
        for i in range(0, len(to_delete), batch_size):
            chunk = to_delete[i : i + batch_size]
            (
                supabase.table(table_name)
                .delete()
                .eq("source", "opensea")
                .in_("token_id", chunk)
                .execute()
            )
        print(f"[originals] Deleted stale tokens: {len(to_delete)}")
    else:
        print("[originals] No stale tokens to delete")


# ---------------------------------------------------------
# TokenWorks: fetch owned Checks + nftForSale prices
# ---------------------------------------------------------
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
        resp = requests.get(url, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()

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
    For each Checks token owned by TokenWorks:
      1. Check if we already have a valid price in the DB (source='tokenworks').
      2. If yes, use that (skip on-chain call).
      3. If no (or price is null), call nftForSale(tokenId) on-chain.
    Returns active listings (price > 0).
    """
    token_ids = fetch_tokenworks_check_token_ids()
    listings: List[Dict[str, Any]] = []

    # 1) Fetch existing cached prices to minimize RPC calls
    # We only care about rows where source='tokenworks'
    try:
        resp = (
            supabase.table(table_name)
            .select("token_id, price_eth")
            .eq("source", "tokenworks")
            .execute()
        )
        db_rows = resp.data or []
        # Map token_id -> price_eth
        db_map = {str(row["token_id"]): row["price_eth"] for row in db_rows}
    except Exception as e:
        print(f"[tokenworks] Error fetching existing rows: {e}")
        db_map = {}

    print(f"[tokenworks] Found {len(token_ids)} owned tokens. Checking prices...")

    for idx, token_id in enumerate(token_ids):
        # Check cache first
        cached_price = db_map.get(token_id)
        
        # If we have a valid cached price, use it and skip RPC
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


def sync_tokenworks(table_name: str) -> None:
    """
    Sync TokenWorks listings into vv_checks_listings with source='tokenworks'.
    This will overwrite any existing row for that token_id (e.g. older OpenSea row).
    We explicitly set highest_offer_eth to None as these listings don't accept WETH offers.
    """
    listings = fetch_tokenworks_listings(table_name)
    
    print(f"[tokenworks] Processing {len(listings)} listings (skipping offers)...")
    
    # Explicitly clear offers
    for row in listings:
        row["highest_offer_eth"] = None
    
    batch_size = 100
    now_ts = datetime.now(timezone.utc).isoformat()
    current_ids = {l["token_id"] for l in listings}
    existing_tokenworks_ids = get_existing_token_ids(table_name, source="tokenworks")

    # Upsert
    for i in range(0, len(listings), batch_size):
        batch = listings[i : i + batch_size]
        for row in batch:
            row["last_seen_at"] = now_ts
            row["source"] = "tokenworks"

        supabase.table(table_name).upsert(
            batch,
            on_conflict="token_id",  # single PK
        ).execute()
    print(f"[tokenworks] Upserted listings: {len(listings)}")

    # Delete stale TokenWorks rows
    to_delete = list(existing_tokenworks_ids - current_ids)
    if to_delete:
        for i in range(0, len(to_delete), batch_size):
            chunk = to_delete[i : i + batch_size]
            (
                supabase.table(table_name)
                .delete()
                .eq("source", "tokenworks")
                .in_("token_id", chunk)
                .execute()
            )
        print(f"[tokenworks] Deleted stale tokens: {len(to_delete)}")
    else:
        print("[tokenworks] No stale tokens to delete")


# ---------------------------------------------------------
# Editions: keep using a separate table (vv_editions_listings)
# ---------------------------------------------------------
def sync_editions(table_name: str = "vv_editions_listings") -> None:
    """
    Sync OpenSea Editions (vv-checks) into vv_editions_listings.
    Editions live in their own table; no source column needed.
    """
    collection_slug = "vv-checks"
    listings = fetch_all_listings_for_collection(collection_slug)
    floor_listings = reduce_to_floor_per_token(listings)

    batch_size = 100
    now_ts = datetime.now(timezone.utc).isoformat()

    print(f"[editions] Processing {len(floor_listings)} listings...")
    offers_set = 0
    for row in floor_listings:
        tid = row["token_id"]
        
        ho = fetch_best_offer_eth(collection_slug, tid)
        if ho is not None:
            row["highest_offer_eth"] = ho
            offers_set += 1

    for i in range(0, len(floor_listings), batch_size):
        batch = floor_listings[i : i + batch_size]
        for row in batch:
            row["last_seen_at"] = now_ts

        supabase.table(table_name).upsert(
            batch,
            on_conflict="token_id",
        ).execute()
    print(f"[editions] Highest offers set: {offers_set}")

    # Delete stale editions
    current_ids = {l["token_id"] for l in floor_listings}
    existing_ids = get_existing_token_ids(table_name, source=None)
    to_delete = list(existing_ids - current_ids)

    if to_delete:
        for i in range(0, len(to_delete), batch_size):
            chunk = to_delete[i : i + batch_size]
            (
                supabase.table(table_name)
                .delete()
                .in_("token_id", chunk)
                .execute()
            )
        print(f"[editions] Deleted stale tokens: {len(to_delete)}")
    else:
        print("[editions] No stale tokens to delete")


# ---------------------------------------------------------
# VValue tracking snapshot
# ---------------------------------------------------------
 


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------
if __name__ == "__main__":
    ORIGINALS_TABLE = "vv_checks_listings"
    ORIGINALS_COLLECTION_SLUG = "vv-checks-originals"

    # 1) OpenSea Originals -> shared table
    sync_opensea_originals(ORIGINALS_TABLE)

    # 2) TokenWorks Originals -> same table, overwriting same token_id when applicable
    sync_tokenworks(ORIGINALS_TABLE)

    # 3) Editions stay separate
    sync_editions("vv_editions_listings")


    print("\nAll syncs completed ✅")
