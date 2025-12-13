import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import osLogo from "./svg/OS.svg";
import twLogo from "./svg/TW.jpg";

// Image URL from Figma
const imgPolygon1 = "http://localhost:3845/assets/15bd32f59846ae19f87bc770bc718256d1a192c6.svg";

const EDITIONS_CONTRACT_ADDRESS = '0x34eebee6942d8def3c125458d1a86e0a897fd6f9';

// Calculate optimal combination to get 64 checks
function calculateOptimalCombination(originals, editions) {
  const gridSizes = [80, 40, 20, 10, 5, 4, 1];
  const dp = new Array(65).fill(Infinity);
  dp[0] = 0;
  const combination = { 0: [] };

  // Group checks by grid size with full data
  const checksByGridSize = {};
  
  // Add originals
  originals.forEach(check => {
    const gridSize = check.checks ? parseInt(check.checks) : null;
    if (gridSize && gridSizes.includes(gridSize)) {
      const key = gridSize.toString();
      if (!checksByGridSize[key]) {
        checksByGridSize[key] = [];
      }
      checksByGridSize[key].push({
        token_id: check.token_id,
        gridSize,
        price: parseFloat(check.price_eth || 0),
        price_eth: check.price_eth,
        image_url: check.image_url,
        isEdition: false,
        source: check.source || "opensea"
      });
    }
  });

  // Add editions (treat as 80 grid size)
  editions.forEach(check => {
    const key = '80';
    if (!checksByGridSize[key]) {
      checksByGridSize[key] = [];
    }
    checksByGridSize[key].push({
      token_id: check.token_id,
      gridSize: 80,
      price: parseFloat(check.price_eth || 0),
      price_eth: check.price_eth,
      image_url: check.image_url,
      isEdition: true,
      source: "opensea"
    });
  });

  // Sort checks in each group by price
  Object.values(checksByGridSize).forEach(group => {
    group.sort((a, b) => a.price - b.price);
  });

  // Helper to count how many checks of a given tier are in a combination
  const countChecksInCombination = (combo, tier) => {
    return combo.filter(c => {
      if (tier === 'Editions') return c.isEdition;
      return !c.isEdition && c.gridSize === parseInt(tier);
    }).length;
  };

  // Helper to get the next available check index for a tier
  const getNextCheckIndex = (combo, tier, availableChecks) => {
    const usedCount = countChecksInCombination(combo, tier);
    // Get all token_ids already used in this combination
    const usedTokenIds = new Set(combo.map(c => c.token_id));
    
    // Find the first check in availableChecks that hasn't been used yet
    for (let i = usedCount; i < availableChecks.length; i++) {
      if (!usedTokenIds.has(availableChecks[i].token_id)) {
        return i;
      }
    }
    // If all checks up to usedCount are already used, return the next one
    return usedCount;
  };

  // Dynamic programming to find optimal combination
  for (let i = 1; i <= 64; i++) {
    for (const size of gridSizes) {
      const checksNeeded = Math.floor(80 / size);
      const key = size.toString();
      if (i >= checksNeeded && checksByGridSize[key] && checksByGridSize[key].length > 0) {
        const prevIndex = i - checksNeeded;
        if (prevIndex >= 0 && dp[prevIndex] !== Infinity) {
          const prevCombo = combination[prevIndex] || [];
          
          // Get the next available check that hasn't been used yet
          const nextIndex = getNextCheckIndex(prevCombo, key, checksByGridSize[key]);
          
          if (nextIndex < checksByGridSize[key].length) {
            const check = checksByGridSize[key][nextIndex];
            const newCost = dp[prevIndex] + check.price;
            if (newCost < dp[i]) {
              dp[i] = newCost;
              // Create a new check object with full data
              combination[i] = [...prevCombo, {
                token_id: check.token_id,
                gridSize: check.gridSize,
                price: check.price,
                price_eth: check.price_eth,
                image_url: check.image_url,
                isEdition: check.isEdition,
                source: check.source
              }];
            }
          }
        }
      }
    }
  }

  const optimalChecks = combination[64] || [];
  const groupedOptimal = groupChecksByTier(optimalChecks);

  const sortedCombination = Object.entries(groupedOptimal)
    .map(([tier, checks]) => {
      const isEdition = tier === 'Editions';
      return {
        tier,
        count: checks.length,
        label: isEdition ? 'Editions' : `${tier} checks`,
        isEdition,
        checks: checks // Include full check data
      };
    })
    .filter(item => item.count > 0)
    .sort((a, b) => {
      if (a.isEdition) return -1;
      if (b.isEdition) return 1;
      const aSize = parseInt(a.tier);
      const bSize = parseInt(b.tier);
      return bSize - aSize;
    });

  return {
    totalCost: dp[64] === Infinity ? 0 : dp[64],
    combination: sortedCombination
  };
}

function groupChecksByTier(checks) {
  const grouped = {
    'Editions': [],
    '80': [],
    '40': [],
    '20': [],
    '10': [],
    '5': [],
    '4': [],
    '1': [],
  };

  checks.forEach(check => {
    if (check.isEdition) {
      grouped['Editions'].push(check);
    } else {
      const key = check.gridSize.toString();
      if (grouped[key]) {
        grouped[key].push(check);
      }
    }
  });

  return grouped;
}

export default function CuratorValue() {
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [error, setError] = useState(null);
  const [expandedTiers, setExpandedTiers] = useState({});
  const [stackMobile, setStackMobile] = useState(false);

  useEffect(() => {
    let mounted = true;
    const updateStack = () => {
      if (typeof window !== "undefined") {
        setStackMobile(window.innerWidth <= 900);
      }
    };
    updateStack();
    window.addEventListener("resize", updateStack);
    async function loadOptimalCombination() {
      if (!supabase) {
        setError("Supabase not configured");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch all originals
        const { data: originalsData, error: originalsError } = await supabase
          .from("vv_checks_listings")
          .select("token_id, price_eth, checks, image_url, source")
          .order("price_eth", { ascending: true });

        // Fetch editions including image_url
        const { data: editionsData, error: editionsError } = await supabase
          .from("vv_editions_listings")
          .select("token_id, price_eth, image_url")
          .order("price_eth", { ascending: true });

        if (!mounted) return;

        if (originalsError) {
          console.error("Error fetching originals:", originalsError);
          setError(originalsError.message);
        } else if (editionsError) {
          console.error("Error fetching editions:", editionsError);
          setError(editionsError.message);
        } else {
          const result = calculateOptimalCombination(
            originalsData || [],
            editionsData || []
          );
          
          setTotalValue(result.totalCost);
          setBreakdown(result.combination);
        }
      } catch (err) {
        if (!mounted) return;
        console.error("Error:", err);
        setError(err.message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadOptimalCombination();
    return () => {
      mounted = false;
      window.removeEventListener("resize", updateStack);
    };
  }, []);

  const formatPrice = (price) => {
    if (price === null || price === undefined) return "0 ETH";
    const priceNum = typeof price === "number" ? price : parseFloat(price || 0);
    if (isNaN(priceNum)) return "0 ETH";
    return priceNum.toLocaleString("en-US", { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 3 
    }) + " ETH";
  };

  const toggleTier = (tier) => {
    setExpandedTiers(prev => ({
      ...prev,
      [tier]: !prev[tier]
    }));
  };

  const getOpenSeaUrl = (tokenId, isEdition) => {
    const contractAddress = isEdition 
      ? '0x34eebee6942d8def3c125458d1a86e0a897fd6f9' // Editions contract
      : '0x036721e5a769cc48b3189efbb9cce4471e8a48b1'; // Originals contract
    return `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
  };

  const getLinkUrl = (check) => {
    if (check.source === "tokenworks") {
      return "https://www.nftstrategy.fun/strategies/0x2090dc81f42f6ddd8deace0d3c3339017417b0dc";
    }
    return getOpenSeaUrl(check.token_id, check.isEdition);
  };

  return (
    <div style={{
      backgroundColor: "#111",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      padding: "16px",
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      flexShrink: 0
    }}>
      <div style={{
        backgroundColor: "#111",
        border: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        alignItems: "flex-start",
        padding: "16px",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        flexShrink: 0
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          alignItems: "flex-start",
          whiteSpace: "normal",
          flexShrink: 0
        }}>
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            fontSize: "1.25em",
            color: "#fff",
            margin: 0
          }}>
            Curator VValue
          </p>
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 400,
            fontSize: "0.75em",
            color: "#7c7c7c",
            margin: 0
          }}>
            Optimal Combination for the Cheapest Check
          </p>
        </div>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          width: "100%",
          maxWidth: "100%",
          flexShrink: 0
        }}>
          <div style={{
            flexBasis: stackMobile ? "auto" : 0,
            backgroundColor: "#111",
            border: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            flexGrow: 1,
            alignItems: "flex-start",
            minHeight: "1px",
            minWidth: "1px",
            padding: "8px",
            alignSelf: "stretch",
            flexShrink: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}>
            <div style={{
              display: "flex",
              alignItems: stackMobile ? "flex-start" : "center",
              justifyContent: "space-between",
              width: "100%",
              maxWidth: "100%",
              flexShrink: 0,
              flexDirection: stackMobile ? "column" : "row",
              gap: stackMobile ? "12px" : undefined,
              boxSizing: "border-box"
            }}>
              <div style={{
                display: "flex",
                gap: "12px",
                rowGap: "4px",
                alignItems: stackMobile ? "flex-start" : "center",
                flexShrink: 0,
                flex: 1,
                width: stackMobile ? "100%" : "auto",
                maxWidth: "100%",
                minWidth: "0",
                flexWrap: "wrap",
                flexDirection: "row"
              }}>
                {breakdown.map((item, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0
                  }}>
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 400,
                      gap: "4px",
                      alignItems: "flex-start",
                      whiteSpace: "normal",
                      flexShrink: 0
                    }}>
                      <p style={{
                        fontSize: "1em",
                        color: "#fff",
                        margin: 0
                      }}>
                        {item.count}
                      </p>
                      <p style={{
                        fontSize: "0.75em",
                        color: "#7c7c7c",
                        margin: 0
                      }}>
                        {item.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: "1.1em",
                color: "#fff",
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textAlign: stackMobile ? "left" : "right",
                alignSelf: stackMobile ? "flex-start" : "auto"
              }}>
                {loading ? "..." : formatPrice(totalValue)}
              </p>
            </div>
            {loading ? null : error ? null : breakdown.length === 0 ? null : (
              breakdown.map((item, idx) => {
                const isExpanded = expandedTiers[item.tier];
                return (
                  <div key={idx} style={{
                    border: "1px solid #333",
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    flexShrink: 0
                  }}>
                    <div 
                      onClick={() => toggleTier(item.tier)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "6px 4px",
                        cursor: "pointer",
                        width: "100%",
                        flexShrink: 0
                      }}
                    >
                      <div style={{
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                        flexShrink: 0,
                        flex: 1
                      }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          <div style={{
                            transform: isExpanded ? "rotate(0deg)" : "rotate(180deg)",
                            flex: "none",
                            transition: "transform 0.2s"
                          }}>
                            <div style={{
                              height: "5px",
                              width: "8px",
                              position: "relative"
                            }}>
                              <div style={{
                                position: "absolute",
                                bottom: "25%",
                                left: "6.7%",
                                right: "6.7%",
                                top: 0
                              }}>
                                <img 
                                  alt="" 
                                  src={imgPolygon1} 
                                  style={{ width: "100%", height: "100%", display: "block" }}
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                    e.target.parentElement.style.borderLeft = "4px solid #333";
                                    e.target.parentElement.style.borderRight = "4px solid transparent";
                                    e.target.parentElement.style.borderTop = "4px solid transparent";
                                    e.target.parentElement.style.borderBottom = "4px solid transparent";
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{
                          display: "flex",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: 400,
                          gap: "6px",
                          alignItems: "center",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}>
                          <p style={{
                            fontSize: "1em",
                            color: "#fff",
                            margin: 0
                          }}>
                            {item.count}
                          </p>
                          <p style={{
                            fontSize: "0.75em",
                            color: "#7c7c7c",
                            margin: 0
                          }}>
                            {item.label}
                          </p>
                        </div>
                      </div>
                    </div>
                    {isExpanded && item.checks && (
                      <div style={{
                        borderTop: "1px solid #333",
                        padding: "12px 8px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                        gap: "12px"
                      }}>
                        {item.checks.map((check, checkIdx) => (
                            <a
                              key={checkIdx}
                              href={getLinkUrl(check)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                textDecoration: "none",
                                color: "#fff",
                                backgroundColor: "#1a1a1a",
                                border: "1px solid #333",
                                borderRadius: "8px",
                                overflow: "hidden",
                                transition: "all 0.2s",
                                cursor: "pointer"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#222";
                                e.currentTarget.style.borderColor = "#444";
                                e.currentTarget.style.transform = "translateY(-2px)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#1a1a1a";
                                e.currentTarget.style.borderColor = "#333";
                                e.currentTarget.style.transform = "translateY(0)";
                              }}
                            >
                              <div style={{
                                width: "100%",
                                aspectRatio: "1",
                                backgroundColor: "#2a2a2a",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                position: "relative"
                              }}>
                                {check.image_url ? (
                                  <>
                                    <img
                                      src={check.image_url}
                                      alt={`Check #${check.token_id}`}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover"
                                      }}
                                      onError={(e) => {
                                        e.target.style.display = "none";
                                        if (e.target.nextSibling) {
                                          e.target.nextSibling.style.display = "flex";
                                        }
                                      }}
                                    />
                                    <div style={{
                                      width: "100%",
                                      height: "100%",
                                      backgroundColor: "#2a2a2a",
                                      display: "none",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "#7c7c7c",
                                      fontSize: "0.6em",
                                      position: "absolute",
                                      top: 0,
                                      left: 0
                                    }}>
                                      #{check.token_id}
                                    </div>
                                  </>
                                ) : (
                                  <div style={{
                                    width: "100%",
                                    height: "100%",
                                    backgroundColor: "#2a2a2a",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#7c7c7c",
                                    fontSize: "0.6em",
                                    flexDirection: "column",
                                    gap: "4px"
                                  }}>
                                    <div>#{check.token_id}</div>
                                    <div style={{ fontSize: "0.5em" }}>No Image URL</div>
                                  </div>
                                )}
                              </div>
                            <div style={{
                              padding: "8px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px"
                            }}>
                              <span style={{
                                color: "#7086fd",
                                fontSize: "0.7em",
                                fontFamily: "Inter, sans-serif",
                                fontWeight: 500
                              }}>
                                #{check.token_id}
                              </span>
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "0.65em"
                              }}>
                                <img
                                  alt=""
                                  src={check.source === "tokenworks" ? (twLogo?.src || twLogo) : (osLogo?.src || osLogo)}
                                  style={{ height: "1em", width: "auto", display: "block" }}
                                  onError={(e) => { e.target.style.display = "none"; }}
                                />
                                <span style={{
                                  color: "#fff",
                                  fontFamily: "Inter, sans-serif"
                                }}>
                                  {formatPrice(check.price_eth)}
                                </span>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
