import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Header from "../components/Header";
import MarketValue from "../components/MarketValue";
import SweepValue from "../components/SweepValue";
import CuratorValue from "../components/CuratorValue";
import BlackCheckProgress from "../components/BlackCheckProgress";
import CheckIcon from "../components/icons/CheckIcon";
import { getBlackCheckData } from "../lib/blackCheck";

export default function Home({ blackCheckData }) {
  const [stackMobile, setStackMobile] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchLastUpdated = async () => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from("vv_checks_listings")
        .select("last_seen_at")
        .order("last_seen_at", { ascending: false })
        .limit(1)
        .single();
      
      if (data && data.last_seen_at) {
        const date = new Date(data.last_seen_at);
        // Format: "Oct 24, 2023, 10:30 PM"
        setLastUpdated(date.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: true
        }));
      }
    } catch (err) {
      console.error("Error fetching last updated:", err);
    }
  };

  useEffect(() => {
    const updateStack = () => {
      if (typeof window !== "undefined") {
        setStackMobile(window.innerWidth <= 900);
      }
    };
    updateStack();
    window.addEventListener("resize", updateStack);
    
    fetchLastUpdated();
    
    return () => window.removeEventListener("resize", updateStack);
  }, []);

  const handleManualUpdate = async () => {
    setIsUpdating(true);
    try {
      // Trigger the Vercel Cron function manually
      await fetch("/api/cron/sync_listings");
      
      // Re-fetch the last updated time
      await fetchLastUpdated();
      
      // Reload the page to refresh data in other components if they don't auto-refresh
      // But user just asked to "display the new update time".
      // Other components (MarketValue etc) might need to re-fetch data.
      // Assuming they fetch on mount/update, we might need to trigger them.
      // For now, let's just update the time as requested.
      
    } catch (err) {
      console.error("Error updating data:", err);
      alert("Failed to update data. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div style={{
      backgroundColor: "#000",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      alignItems: "stretch",
      padding: "24px",
      boxSizing: "border-box",
      minHeight: "100vh",
      width: "100%",
      maxWidth: "100vw",
      overflowX: "hidden"
    }}>
      <Header 
        lastUpdated={lastUpdated} 
        onManualUpdate={handleManualUpdate}
        isUpdating={isUpdating}
      />
      <BlackCheckProgress {...blackCheckData} />
      <MarketValue />
      <SweepValue />
      <CuratorValue />
      <div style={{
        backgroundColor: "#111",
        border: "1px solid #333",
        display: "flex",
        flexDirection: stackMobile ? "column" : "row",
        alignItems: "center",
        justifyContent: stackMobile ? "center" : "space-between",
        flexWrap: "wrap",
        rowGap: "8px",
        columnGap: "12px",
        padding: "12px 16px",
        width: "100%",
        flexShrink: 0
      }}>
        <p style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: "0.75em",
          color: "#7c7c7c",
          margin: 0,
          whiteSpace: "normal",
          flex: stackMobile ? "none" : 1,
          textAlign: stackMobile ? "center" : "left",
          minWidth: "0"
        }}>
          This only looks over OpenSea and TokenWorks assets. We are not tracking Gondi and Blur listings.
        </p>
        <a href="https://x.com/0xHarsheth" target="_blank" rel="noopener noreferrer" style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          fontSize: "0.75em",
          color: "#fff",
          textDecoration: "none",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "4px"
        }}>
          <CheckIcon color="#fff" style={{ width: "16px", height: "16px", display: "block" }} />
          Curated by 0xHarsh
        </a>
      </div>
    </div>
  );
}

export async function getStaticProps() {
  try {
    const blackCheckData = await getBlackCheckData();
    return {
      props: {
        blackCheckData
      },
      revalidate: 300
    };
  } catch (err) {
    console.error("Error fetching Black Check stats:", err);
    return {
      props: {
        blackCheckData: {
          checksAllocated: "3/64",
          blkchkAllocated: "0.04638671875"
        }
      },
      revalidate: 60
    };
  }
}
