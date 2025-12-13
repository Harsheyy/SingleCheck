import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Check icon SVG component
const CheckIcon = ({ color = "currentColor", ...props }) => (
  <svg width="24" height="24" viewBox="0 0 45 45" fill={color} stroke={color} strokeWidth="1.25" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M45 23.5547C45 25.1279 44.6221 26.5869 43.8662 27.9229C43.1104 29.2588 42.0996 30.3047 40.8252 31.0342C40.8604 31.2715 40.8779 31.6406 40.8779 32.1416C40.8779 34.5234 40.0781 36.5449 38.4961 38.2148C36.9053 39.8936 34.9893 40.7285 32.748 40.7285C31.7461 40.7285 30.7881 40.5439 29.8828 40.1748C29.1797 41.6162 28.1689 42.7764 26.8418 43.6641C25.5234 44.5605 24.0732 45 22.5 45C20.8916 45 19.4326 44.5693 18.1318 43.6904C16.8223 42.8203 15.8203 41.6514 15.1172 40.1748C14.2119 40.5439 13.2627 40.7285 12.252 40.7285C10.0107 40.7285 8.08594 39.8936 6.47754 38.2148C4.86914 36.5449 4.06934 34.5146 4.06934 32.1416C4.06934 31.8779 4.10449 31.5088 4.16602 31.0342C2.8916 30.2959 1.88086 29.2588 1.125 27.9229C0.37793 26.5869 0 25.1279 0 23.5547C0 21.8848 0.421875 20.3467 1.25684 18.958C2.0918 17.5693 3.2168 16.541 4.62305 15.873C4.25391 14.8711 4.06934 13.8604 4.06934 12.8584C4.06934 10.4854 4.86914 8.45508 6.47754 6.78516C8.08594 5.11523 10.0107 4.27148 12.252 4.27148C13.2539 4.27148 14.2119 4.45605 15.1172 4.8252C15.8203 3.38379 16.8311 2.22363 18.1582 1.33594C19.4766 0.448242 20.9268 0 22.5 0C24.0732 0 25.5234 0.448242 26.8418 1.32715C28.1602 2.21484 29.1797 3.375 29.8828 4.81641C30.7881 4.44727 31.7373 4.2627 32.748 4.2627C34.9893 4.2627 36.9053 5.09766 38.4961 6.77637C40.0869 8.45508 40.8779 10.4766 40.8779 12.8496C40.8779 13.957 40.7109 14.959 40.377 15.8643C41.7832 16.5322 42.9082 17.5605 43.7432 18.9492C44.5781 20.3467 45 21.8848 45 23.5547ZM21.542 30.3311L30.832 16.418C31.0693 16.0488 31.1396 15.6445 31.0605 15.2139C30.9727 14.7832 30.7529 14.4404 30.3838 14.2119C30.0147 13.9746 29.6104 13.8955 29.1797 13.957C28.7402 14.0273 28.3887 14.2383 28.125 14.6074L19.9424 26.9121L16.1719 23.1504C15.8379 22.8164 15.4512 22.6582 15.0205 22.6758C14.5811 22.6934 14.2031 22.8516 13.8691 23.1504C13.5703 23.4492 13.4209 23.8271 13.4209 24.2842C13.4209 24.7324 13.5703 25.1104 13.8691 25.418L19.0459 30.5947L19.3008 30.7969C19.5996 30.999 19.9072 31.0957 20.2061 31.0957C20.7949 31.0869 21.2432 30.8408 21.542 30.3311Z"/>
  </svg>
);

export default function SweepValue() {
  const [loading, setLoading] = useState(true);
  const [editionsValue, setEditionsValue] = useState(null);
  const [originalsValue, setOriginalsValue] = useState(null);
  const [tokenworksValue, setTokenworksValue] = useState(null);
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
    async function loadSweepValues() {
      if (!supabase) {
        setError("Supabase not configured");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch cheapest 64 editions (limit to 64)
        const { data: editionsData, error: editionsError } = await supabase
          .from("vv_editions_listings")
          .select("price_eth")
          .order("price_eth", { ascending: true })
          .limit(64);

        // Fetch cheapest 64 originals from opensea only
        const { data: originalsData, error: originalsError } = await supabase
          .from("vv_checks_listings")
          .select("price_eth")
          .eq("source", "opensea")
          .order("price_eth", { ascending: true })
          .limit(64);

        // Fetch cheapest 64 originals from TokenWorks only
        const { data: twData, error: twError } = await supabase
          .from("vv_checks_listings")
          .select("price_eth")
          .eq("source", "tokenworks")
          .order("price_eth", { ascending: true })
          .limit(64);

        if (!mounted) return;

        if (editionsError) {
          console.error("Error fetching editions:", editionsError);
          setError(editionsError.message);
        } else if (originalsError) {
          console.error("Error fetching originals:", originalsError);
          setError(originalsError.message);
        } else if (twError) {
          console.error("Error fetching TokenWorks originals:", twError);
          setError(twError.message);
        } else {
          // Calculate sum of prices
          const calculateSum = (items) => {
            if (!items || items.length === 0) return 0;
            return items.reduce((sum, item) => {
              const price = typeof item.price_eth === "string" 
                ? parseFloat(item.price_eth) 
                : Number(item.price_eth || 0);
              return sum + (isNaN(price) ? 0 : price);
            }, 0);
          };

          const editionsSum = calculateSum(editionsData);
          const originalsSum = calculateSum(originalsData);
          const twSum = calculateSum(twData);

          setEditionsValue(editionsSum);
          setOriginalsValue(originalsSum);
          setTokenworksValue(twSum);
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

    loadSweepValues();
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
        <p style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: "1.25em",
          color: "#fff",
          margin: 0,
          whiteSpace: "nowrap"
        }}>
          Sweep VValue
        </p>
        <div style={{
          display: "flex",
          gap: stackMobile ? undefined : "12px",
          rowGap: stackMobile ? "12px" : undefined,
          alignItems: "flex-start",
          width: "100%",
          flexShrink: 0,
          flexWrap: stackMobile ? "nowrap" : "wrap",
          flexDirection: stackMobile ? "column" : "row"
        }}>
          <div style={{
            flexBasis: stackMobile ? "auto" : 0,
            backgroundColor: "#111",
            border: "1px solid #333",
            display: "flex",
            flexGrow: 1,
            alignItems: stackMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            minHeight: "1px",
            minWidth: stackMobile ? "0" : "280px",
            padding: "8px",
            alignSelf: "stretch",
            flexShrink: 0,
            flexDirection: stackMobile ? "column" : "row",
            width: "100%",
            gap: stackMobile ? "8px" : undefined
          }}>
            <div style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexShrink: 0,
              flex: stackMobile ? 1 : undefined,
              minWidth: stackMobile ? "0" : undefined
            }}>
              <div style={{
                width: "24px",
                height: "24px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <CheckIcon 
                  color="#fff" // White check for editions
                  style={{ 
                    width: "100%", 
                    height: "100%", 
                    display: "block"
                  }}
                />
              </div>
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
                  Editions
                </p>
                <p style={{
                  fontSize: "0.75em",
                  color: "#7c7c7c",
                  margin: 0
                }}>
                  Sweep 64 Editions
                </p>
              </div>
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
              textAlign: "right",
              alignSelf: stackMobile ? "flex-end" : "auto"
            }}>
              {loading ? "..." : formatPrice(editionsValue)}
            </p>
          </div>
          <div style={{
            flexBasis: stackMobile ? "auto" : 0,
            backgroundColor: "#111",
            border: "1px solid #333",
            display: "flex",
            flexGrow: 1,
            alignItems: stackMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            minHeight: "1px",
            minWidth: stackMobile ? "0" : "280px",
            padding: "8px",
            alignSelf: "stretch",
            flexShrink: 0,
            flexDirection: stackMobile ? "column" : "row",
            width: "100%",
            gap: stackMobile ? "8px" : undefined
          }}>
            <div style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexShrink: 0,
              flex: stackMobile ? 1 : undefined,
              minWidth: stackMobile ? "0" : undefined
            }}>
              <div style={{
                width: "24px",
                height: "24px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <CheckIcon 
                  color="#069420" // Green check for originals
                  style={{ 
                    width: "100%", 
                    height: "100%", 
                    display: "block"
                  }}
                />
              </div>
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
                  OpenSea Originals
                </p>
                <p style={{
                  fontSize: "0.75em",
                  color: "#7c7c7c",
                  margin: 0
                }}>
                  Sweep 64 Originals
                </p>
              </div>
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
              textAlign: "right",
              alignSelf: stackMobile ? "flex-end" : "auto"
            }}>
              {loading ? "..." : formatPrice(originalsValue)}
            </p>
          </div>
          <div style={{
            flexBasis: stackMobile ? "auto" : 0,
            backgroundColor: "#111",
            border: "1px solid #333",
            display: "flex",
            flexGrow: 1,
            alignItems: stackMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            minHeight: "1px",
            minWidth: stackMobile ? "0" : "280px",
            padding: "8px",
            alignSelf: "stretch",
            flexShrink: 0,
            flexDirection: stackMobile ? "column" : "row",
            width: "100%",
            gap: stackMobile ? "8px" : undefined
          }}>
            <div style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexShrink: 0,
              flex: stackMobile ? 1 : undefined,
              minWidth: stackMobile ? "0" : undefined
            }}>
              <div style={{
                width: "24px",
                height: "24px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <CheckIcon 
                  color="#7086fd"
                  style={{ 
                    width: "100%", 
                    height: "100%", 
                    display: "block"
                  }}
                />
              </div>
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
                  TokenWorks
                </p>
                <p style={{
                  fontSize: "0.75em",
                  color: "#7c7c7c",
                  margin: 0
                }}>
                  Sweep 64 Checks
                </p>
              </div>
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
              textAlign: "right",
              alignSelf: stackMobile ? "flex-end" : "auto"
            }}>
              {loading ? "..." : formatPrice(tokenworksValue)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
