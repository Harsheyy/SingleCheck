import React from "react";

export default function BlackCheckProgress({ 
  checksAllocated = "0/64", 
  blkchkAllocated = "0"
}) {
  // Parse inputs to numbers for progress calculation
  // checksAllocated format is "X/64"
  const checksCount = parseFloat(checksAllocated.split("/")[0]) || 0;
  const progressPercent = (checksCount / 64) * 100;

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
          fontSize: "1.25em",
          color: "#fff",
          margin: 0,
          whiteSpace: "nowrap"
        }}>
          Black Check Progress
        </p>
        <div style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          width: "100%",
          flexShrink: 0,
          gap: "24px",
          flexWrap: "wrap"
        }}>
          <div style={{
            display: "flex",
            flexDirection: "row",
            gap: "24px",
            alignItems: "flex-start",
            flexShrink: 0
          }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              gap: "4px",
              alignItems: "flex-start",
              whiteSpace: "nowrap"
            }}>
              <p style={{
                fontSize: "1em",
                color: "#fff",
                margin: 0
              }}>
                {checksAllocated}
              </p>
              <p style={{
                fontSize: "0.75em",
                color: "#7c7c7c",
                margin: 0
              }}>
                Checks allocated
              </p>
            </div>
            <div style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              gap: "4px",
              alignItems: "flex-start",
              whiteSpace: "nowrap"
            }}>
              <p style={{
                fontSize: "1em",
                color: "#fff",
                margin: 0
              }}>
                {blkchkAllocated}
              </p>
              <p style={{
                fontSize: "0.75em",
                color: "#7c7c7c",
                margin: 0
              }}>
                $BLKCHK allocated
              </p>
            </div>
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            flex: 1,
            minWidth: "200px"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              gap: "8px"
            }}>
               <div style={{
                backgroundColor: "#333",
                height: "4.31px",
                borderRadius: "35.917px",
                flex: 1,
                position: "relative",
                overflow: "hidden"
              }}>
                <div style={{
                  position: "absolute",
                  backgroundColor: "#fff",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${progressPercent}%`,
                  borderRadius: "35.917px"
                }} />
              </div>
              <p style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: "12px",
                color: "#fff",
                margin: 0,
                whiteSpace: "nowrap"
              }}>
                {progressPercent.toFixed(2)}%
              </p>
            </div>
            <p style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              fontSize: "12px",
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

