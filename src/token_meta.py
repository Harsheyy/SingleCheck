import os
import time
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
ALCHEMY_API_KEY = os.getenv("ALCHEMY_API_KEY")
CHECKS_EDITIONS_CONTRACT = os.getenv("CHECKS_EDITIONS_CONTRACT")
CHECKS_ORIGINALS_CONTRACT = os.getenv("CHECKS_ORIGINALS_CONTRACT")
OPENSEA_API_KEY = os.getenv("OPENSEA_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
ALCHEMY_BASE_URL = f"https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}"


# --------------------------------------------
# Fetch tokens that still need metadata
# --------------------------------------------
def get_originals_needing_metadata() -> List[str]:
    resp = (
        supabase
        .table("vv_checks_listings")
        .select("token_id, image_url")
        .is_("image_url", None)
        .execute()
    )

    rows = resp.data or []
    token_ids = [row["token_id"] for row in rows]

    return token_ids


# --------------------------------------------
# Fetch metadata from Alchemy for 1 token
# --------------------------------------------
def fetch_metadata_from_alchemy(token_id: str) -> Optional[Dict[str, Any]]:
    url = f"{ALCHEMY_BASE_URL}/getNFTMetadata"
    params = {
        "contractAddress": CHECKS_ORIGINALS_CONTRACT,
        "tokenId": token_id,
        "refreshCache": "false",
    }

    try:
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()
    except Exception as e:
        print(f"Error fetching metadata for {token_id}: {e}")
        return None

    metadata = data.get("metadata") or {}
    media = data.get("media") or []

    # Prefer HTTPS gateway image from `media[0]` (matches your screenshot)
    image_url = None
    if media:
        image_url = (
            media[0].get("gateway")
            or media[0].get("thumbnail")
            or media[0].get("raw")
        )

    # As fallback, use metadata.image (might be a data URL base64)
    if not image_url:
        img = metadata.get("image")
        if isinstance(img, str):
            image_url = img

    return {
        "image_url": image_url,
        "attributes": metadata.get("attributes") or [],
    }


# --------------------------------------------
# Turn attributes array → typed columns
# --------------------------------------------
def parse_trait_columns(attributes: List[Dict[str, Any]]) -> Dict[str, Any]:
    trait_map = {a.get("trait_type"): a.get("value") for a in attributes}

    def to_int(val):
        try:
            return int(str(val))
        except:
            return None

    return {
        "checks": to_int(trait_map.get("Checks")),
        "color_band": trait_map.get("Color Band"),
        "day": to_int(trait_map.get("Day")),
        "gradient": trait_map.get("Gradient"),
        "shift": trait_map.get("Shift"),
        "speed": trait_map.get("Speed"),
    }


# --------------------------------------------
# Update Supabase with metadata for 1 token
# --------------------------------------------
def update_token_metadata_in_supabase(token_id: str, meta: Dict[str, Any]) -> None:
    trait_cols = parse_trait_columns(meta["attributes"])

    supabase.table("vv_checks_listings").update(
        {
            "image_url": meta["image_url"],
            **trait_cols,
        }
    ).eq("token_id", token_id).execute()


# --------------------------------------------
# MAIN: Populate missing metadata
# --------------------------------------------
def enrich_originals_with_metadata():
    token_ids = get_originals_needing_metadata()

    for idx, token_id in enumerate(token_ids):
        print(f"[{idx+1}/{len(token_ids)}] Fetching metadata for {token_id}…")

        meta = fetch_metadata_from_alchemy(token_id)
        if not meta:
            continue

        update_token_metadata_in_supabase(token_id, meta)
        time.sleep(0.15)


def get_editions_needing_metadata() -> List[str]:
    # Collect tokens where image_url is NULL or empty string
    resp_null = (
        supabase
        .table("vv_editions_listings")
        .select("token_id, image_url")
        .is_("image_url", None)
        .execute()
    )
    resp_empty = (
        supabase
        .table("vv_editions_listings")
        .select("token_id, image_url")
        .eq("image_url", "")
        .execute()
    )

    rows = (resp_null.data or []) + (resp_empty.data or [])
    token_ids = [row["token_id"] for row in rows]
    # De-duplicate token ids
    return list(dict.fromkeys(token_ids))


def fetch_editions_metadata(token_id: str) -> Optional[Dict[str, Any]]:
    # Try OpenSea v2 NFT endpoint first
    if OPENSEA_API_KEY:
        try:
            os_url = f"https://api.opensea.io/api/v2/chain/ethereum/contract/{CHECKS_EDITIONS_CONTRACT}/nfts/{token_id}"
            headers = {"accept": "*/*", "x-api-key": OPENSEA_API_KEY}
            r = requests.get(os_url, headers=headers, timeout=10)
            if r.status_code == 200:
                d = r.json()
                nft = d.get("nft") or {}
                image_url = nft.get("image_url") or (nft.get("metadata") or {}).get("image")
                if image_url:
                    return {"image_url": image_url}
        except Exception:
            pass

    # Fallback to Alchemy
    url = f"{ALCHEMY_BASE_URL}/getNFTMetadata"
    params = {
        "contractAddress": CHECKS_EDITIONS_CONTRACT,
        "tokenId": token_id,
        "refreshCache": "false",
    }
    try:
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()
    except Exception:
        return None

    metadata = data.get("metadata") or {}
    media = data.get("media") or []

    image_url = None
    top_img = data.get("image")
    if isinstance(top_img, str) and top_img:
        image_url = top_img
    elif isinstance(metadata.get("image"), str) and metadata.get("image"):
        image_url = metadata.get("image")
    elif media:
        image_url = (
            media[0].get("gateway")
            or media[0].get("thumbnail")
            or media[0].get("raw")
        )

    return {"image_url": image_url}


def update_edition_metadata(token_id: str, meta: Dict[str, Any]) -> None:
    supabase.table("vv_editions_listings").update(
        {"image_url": meta.get("image_url")}
    ).eq("token_id", token_id).execute()


def enrich_editions_with_metadata():
    edition_ids = get_editions_needing_metadata()
    updated = 0
    for token_id in edition_ids:
        meta = fetch_editions_metadata(token_id)
        img = meta.get("image_url") if meta else None
        if img:
            update_edition_metadata(token_id, meta)
            updated += 1

    print(f"✓ Metadata enrichment complete (editions updated: {updated})")


if __name__ == "__main__":
    enrich_originals_with_metadata()
    enrich_editions_with_metadata()
