import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function MarketValue() {
  const [loading, setLoading] = useState(true);
  const [cheapestCheck, setCheapestCheck] = useState(null);
  const [error, setError] = useState(null);
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
    async function loadCheapestCheck() {
      if (!supabase) {
        setError("Supabase not configured");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Find the cheapest check where checks = 1
        // Try as number first, then as string if needed
        let { data: dataArray, error: queryError } = await supabase
          .from("vv_checks_listings")
          .select("token_id, price_eth, highest_offer_eth, owner, source, image_url, checks, color_band, day, gradient, shift, speed")
          .eq("checks", 1)
          .order("price_eth", { ascending: true })
          .limit(1);

        let data = dataArray && dataArray.length > 0 ? dataArray[0] : null;
        
        // If no results with number, try as string
        if (!data && (!queryError || queryError.code === 'PGRST116')) {
          const result = await supabase
            .from("vv_checks_listings")
            .select("token_id, price_eth, highest_offer_eth, owner, source, image_url, checks, color_band, day, gradient, shift, speed")
            .eq("checks", "1")
            .order("price_eth", { ascending: true })
            .limit(1);
          data = result.data && result.data.length > 0 ? result.data[0] : null;
          queryError = result.error;
        }

        if (!mounted) return;

        if (queryError) {
          console.error("Error fetching cheapest check:", queryError);
          setError(queryError.message);
        } else {
          setCheapestCheck(data);
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

    loadCheapestCheck();
    return () => {
      mounted = false;
      window.removeEventListener("resize", updateStack);
    };
  }, []);

  const formatPrice = (price) => {
    if (!price) return "";
    const priceNum = typeof price === "string" ? parseFloat(price) : Number(price || 0);
    if (isNaN(priceNum)) return "";
    return priceNum.toLocaleString("en-US", { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 3 
    }) + " ETH";
  };

  return (
    <div style={{
      backgroundColor: "#111",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      padding: "16px",
      width: "100%",
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
        flexShrink: 0
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          alignItems: "flex-start",
          whiteSpace: "nowrap",
          flexShrink: 0
        }}>
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            fontSize: "1.25em",
            color: "#fff",
            margin: 0
          }}>
            Market VValue
          </p>
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 400,
            fontSize: "0.75em",
            color: "#7c7c7c",
            margin: 0
          }}>
            Cheapest Check on Market
          </p>
        </div>
        {loading ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            color: "#7c7c7c",
            fontSize: "12px"
          }}>
            Loading...
          </div>
        ) : error ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            color: "#ff6b6b",
            fontSize: "12px"
          }}>
            Error: {error}
          </div>
        ) : !cheapestCheck ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            color: "#7c7c7c",
            fontSize: "12px"
          }}>
            No checks found
          </div>
        ) : (
          <div style={{
            display: "flex",
            gap: "10px",
            alignItems: "stretch",
            flexShrink: 0,
            flexDirection: stackMobile ? "column" : "row",
            width: "100%"
          }}>
            <div style={{
              width: stackMobile ? "100%" : "124px",
              minHeight: "124px",
              alignSelf: stackMobile ? "auto" : "stretch",
              borderRadius: "8px",
              overflow: "hidden",
              backgroundColor: "#d9d9d9",
              flexShrink: 0
            }}>
              {cheapestCheck.image_url ? (
                <img
                  src={cheapestCheck.image_url}
                  alt={`Check #${cheapestCheck.token_id}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block"
                  }}
                  onError={(e) => {
                    e.target.style.display = "none";
                    if (e.target.nextSibling) {
                      e.target.nextSibling.style.display = "block";
                    }
                  }}
                />
              ) : null}
              <div style={{
                width: "100%",
                height: "100%",
                display: cheapestCheck.image_url ? "none" : "block"
              }} />
            </div>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              alignItems: "flex-start",
              justifyContent: "center",
              whiteSpace: "normal",
              color: "#fff",
              flexShrink: 0,
              flexGrow: 1,
              minWidth: "0",
              width: "100%"
            }}>
              <p style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: "1.1em",
                color: "#fff",
                margin: 0
              }}>
                {formatPrice(cheapestCheck.price_eth)}
              </p>
              <p style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                margin: 0
              }}>
                <span style={{ color: "#7c7c7c", fontSize: "0.75em" }}>Token ID </span>
                <span style={{ color: "#fff", fontSize: ".8em" }}>#{cheapestCheck.token_id}</span>
              </p>
              {cheapestCheck.highest_offer_eth ? (
                <p style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  margin: 0
                }}>
                  <span style={{ color: "#7c7c7c", fontSize: "0.75em" }}>Highest Offer  </span>
                  <span style={{ color: "#fff", fontSize: ".8em" }}>{formatPrice(cheapestCheck.highest_offer_eth)}</span>
                </p>
              ) : null}
              {cheapestCheck.owner ? (
                <p style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  margin: 0
                }}>
                  <span style={{ color: "#7c7c7c", fontSize: "0.75em" }}>Owner  </span>
                  <span style={{ color: "#fff", fontSize: ".8em", wordBreak: "break-all", overflowWrap: "anywhere", whiteSpace: "normal", display: "inline-block", maxWidth: "100%" }}>{cheapestCheck.owner}</span>
                </p>
              ) : null}
              <a
                href={`https://opensea.io/assets/ethereum/0x036721e5a769cc48b3189efbb9cce4471e8a48b1/${cheapestCheck.token_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 400,
                  fontSize: "0.75em",
                  color: "#7086fd",
                  textDecoration: "none",
                  marginTop: "4px",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.target.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  e.target.style.textDecoration = "none";
                }}
              >
                View on OpenSea →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
