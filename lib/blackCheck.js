import { ethers } from "ethers";
import { Alchemy, Network } from "alchemy-sdk";

const BLKCHK_ADDRESS = "0x718477C471B335ee0ca29B9f4b95Edd26d2eDE54";
const CHECKS_ORIGINALS_CONTRACT = "0x036721e5A769Cc48B3189EFbb9ccE4471E8A48B1";

export async function getBlackCheckData() {
  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const ALCHEMY_RPC_URL = process.env.ALCHEMY_RPC_URL || process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  
  if (!ALCHEMY_API_KEY) {
     console.warn("No ALCHEMY_API_KEY found, using fallback data.");
     throw new Error("No API KEY");
  }

  // Initialize Alchemy SDK
  const config = {
    apiKey: ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
  };
  const alchemy = new Alchemy(config);

  // 1. Fetch Total Supply of BLKCHK
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
  const blkchkContract = new ethers.Contract(
    BLKCHK_ADDRESS,
    ["function totalSupply() view returns (uint256)"],
    provider
  );
  
  const totalSupplyWei = await blkchkContract.totalSupply();
  const totalSupply = parseFloat(ethers.formatUnits(totalSupplyWei, 18));

  // 2. Fetch NFTs owned by the vault (checks allocated)
  // Fetch all NFTs to ensure we get them
  const nfts = await alchemy.nft.getNftsForOwner(BLKCHK_ADDRESS, {
    contractAddresses: [CHECKS_ORIGINALS_CONTRACT],
  });

  let totalWeight = 0;

  for (const nft of nfts.ownedNfts) {
    let checkCount = 0;
    
    // Try to get from metadata first
    const attributes = nft.rawMetadata?.attributes || [];
    const checksAttr = attributes.find(a => a.trait_type === "Checks");
    
    if (checksAttr) {
      checkCount = parseInt(checksAttr.value);
    } else {
      // Fallback: Fetch tokenURI directly if metadata is missing
      try {
         const tokenContract = new ethers.Contract(
           CHECKS_ORIGINALS_CONTRACT,
           ["function tokenURI(uint256) view returns (string)"],
           provider
         );
         const uri = await tokenContract.tokenURI(nft.tokenId);
         if (uri) {
           // Parse URI
           let jsonStr = uri;
           if (uri.startsWith("data:application/json;base64,")) {
             const base64 = uri.split(",")[1];
             jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
           }
           
           try {
              const metadata = JSON.parse(jsonStr);
              const attr = metadata.attributes?.find(a => a.trait_type === "Checks");
              if (attr) {
                checkCount = parseInt(attr.value);
              }
           } catch (e) {
             console.warn("JSON parse failed for tokenURI", nft.tokenId);
           }
         }
      } catch (err) {
        console.error(`Failed to fetch/parse tokenURI for ${nft.tokenId}:`, err);
      }
    }

    // Weight calculation
    let weight = 0;
    switch (checkCount) {
      case 80: weight = 1; break;
      case 40: weight = 2; break;
      case 20: weight = 4; break;
      case 10: weight = 8; break;
      case 5: weight = 16; break;
      case 4: weight = 16; break; 
      case 1: weight = 64; break;
      default: weight = 0;
    }
    
    totalWeight += weight;
  }
  
  // Calculate Single Check Equivalent
  // Total Weight / 64
  const totalSingleCheckEquivalent = totalWeight / 64;

  return {
    checksAllocated: `${totalSingleCheckEquivalent.toFixed(4)}/64`,
    blkchkAllocated: totalSupply.toString()
  };
}
