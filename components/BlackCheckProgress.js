import React from "react";

export default function BlackCheckProgress() {
  // Hard-coded values - will be replaced with Supabase data later
  const checksAllocated = "3/64";
  const blkchkAllocated = "0.04638671875";
  const blkchkHolders = "137";
  const progressPercent = 3.66; // 3/64 * 100

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
        gap: "16px",
        alignItems: "flex-start",
        padding: "16px",
        width: "100%",
        flexShrink: 0
      }}>
        <p style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: "0.75em",
          color: "#fff",
          margin: 0,
          whiteSpace: "nowrap"
        }}>
          Black Check Progress
        </p>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          width: "100%",
          flexShrink: 0
        }}>
          <div style={{
            display: "inline-grid",
            gridTemplateColumns: "max-content",
            gridTemplateRows: "max-content",
            lineHeight: 0,
            placeItems: "start",
            flexShrink: 0
          }}>
            <div style={{
              gridArea: "1 / 1",
              display: "flex",
              flexDirection: "column",
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              gap: "4px",
              alignItems: "flex-start",
              marginLeft: 0,
              marginTop: 0,
              whiteSpace: "nowrap"
            }}>
              <p style={{
                fontSize: "0.75em",
                color: "#fff",
                margin: 0
              }}>
                {checksAllocated}
              </p>
              <p style={{
                fontSize: "0.5em",
                color: "#7c7c7c",
                margin: 0
              }}>
                Checks allocated
              </p>
            </div>
            <div style={{
              gridArea: "1 / 1",
              display: "flex",
              flexDirection: "column",
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              gap: "4px",
              alignItems: "flex-start",
              marginLeft: "81px",
              marginTop: 0,
              whiteSpace: "nowrap"
            }}>
              <p style={{
                fontSize: "0.75em",
                color: "#fff",
                margin: 0
              }}>
                {blkchkAllocated}
              </p>
              <p style={{
                fontSize: "0.5em",
                color: "#7c7c7c",
                margin: 0
              }}>
                $BLKCHK allocated
              </p>
            </div>
            <div style={{
              gridArea: "1 / 1",
              display: "flex",
              flexDirection: "column",
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              gap: "4px",
              alignItems: "flex-start",
              marginLeft: "187px",
              marginTop: 0,
              whiteSpace: "nowrap"
            }}>
              <p style={{
                fontSize: "0.75em",
                color: "#fff",
                margin: 0
              }}>
                {blkchkHolders}
              </p>
              <p style={{
                fontSize: "0.5em",
                color: "#7c7c7c",
                margin: 0
              }}>
                $BLKCHK holders
              </p>
            </div>
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            alignSelf: "stretch",
            flexShrink: 0,
            width: "500px"
          }}>
            <div style={{
              backgroundColor: "#333",
              height: "4.31px",
              borderRadius: "35.917px",
              flexShrink: 0,
              width: "100%",
              position: "relative"
            }}>
              <div style={{
                position: "absolute",
                backgroundColor: "#fff",
                top: "0.13px",
                right: `${100 - progressPercent}%`,
                bottom: "0.18px",
                left: 0,
                borderRadius: "35.917px"
              }} />
            </div>
            <p style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              fontSize: "8px",
              color: "#7c7c7c",
              margin: 0,
              whiteSpace: "nowrap"
            }}>
              Black Check Progress
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

