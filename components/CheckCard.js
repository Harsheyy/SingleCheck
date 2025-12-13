import React, { useState } from "react";

export default function CheckCard({ item }) {
  const [hover, setHover] = useState(false);
  const priceNum = typeof item.price_eth === "string" ? parseFloat(item.price_eth) : Number(item.price_eth || 0);
  const priceFmt = isNaN(priceNum)
    ? ""
    : priceNum.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 12,
        position: "relative",
        background: "#fff",
      }}
    >
      {item.image_url && (
        <div style={{ marginBottom: 8 }}>
          <img
            src={item.image_url}
            alt={"Check " + item.token_id}
            style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 6 }}
          />
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>#{item.token_id}</div>
        <div>{priceFmt ? `${priceFmt} ETH` : ""}</div>
      </div>
      {hover && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#333" }}>
          <div>source: {item.source || ""}</div>
          <div>checks: {item.checks ?? ""}</div>
          <div>color_band: {item.color_band ?? ""}</div>
          <div>day: {item.day ?? ""}</div>
          <div>gradient: {item.gradient ?? ""}</div>
          <div>shift: {item.shift ?? ""}</div>
          <div>speed: {item.speed ?? ""}</div>
        </div>
      )}
    </div>
  );
}
