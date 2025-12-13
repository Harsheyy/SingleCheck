"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Image URLs from Figma
const imgLine = "http://localhost:3845/assets/3e5361714649b00a6a9e2a2a1becca40ae3c8bf9.svg";
const imgLine1 = "http://localhost:3845/assets/086d496126ac9c0c04fd0664ad9aa223a98f2cd9.svg";
const imgLine2 = "http://localhost:3845/assets/0b3e84291673c5748b44b58114dfc39f67a4e42d.svg";
const imgSingleLineArea0 = "http://localhost:3845/assets/4894fadc93ae0cb19266876021cd3ba5748132f4.svg";
const imgSingleLine0 = "http://localhost:3845/assets/a93f51336f3f5024ae54e079cfb9545080991ad7.svg";
const imgRipple = "http://localhost:3845/assets/9d66a7b84b7bee6db03bc1c0780f979d11e2a44a.svg";
const imgEllipseFill = "http://localhost:3845/assets/ccb4c818200fdf8dcea9bdba56badc68aadfeb61.svg";
const imgBasicNode = "http://localhost:3845/assets/f3653e62e8ac27be38c489bffecd107d5520ccf4.svg";
const imgBasicNode1 = "http://localhost:3845/assets/c262f7794aeec712f6e379f190d092bed1a532fc.svg";
const imgBasicNode2 = "http://localhost:3845/assets/59265e85e97c83839344e6cf3087f98fec8a3d5b.svg";

export default function ValueChart() {
  const yAxisLabels = ["100e", "80e", "60e", "40e", "20e", "0"];
  const xAxisLabels = [
    "Mar 14th", "Apr 14th", "May 14th", "Jun 14th", "Jul 14th",
    "Aug 14th", "Sep 14th", "Oct 14th", "Nov 14th", "Dec 14th",
    "Jan 14th", "Feb 14th"
  ];

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      if (!supabase) {
        setError("Supabase not configured");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data, error: qerr } = await supabase
          .from("vv_value_tracking")
          .select("timestamp, market_value, highest_offer_eth, sweep_value, optimal_value")
          .order("timestamp", { ascending: true });
        if (!mounted) return;
        if (qerr) {
          setError(qerr.message);
        } else {
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  const toNum = (x) => {
    const n = typeof x === "string" ? parseFloat(x) : Number(x || 0);
    return isNaN(n) ? 0 : n;
  };

  const marketSeries = rows.map(r => toNum(r.market_value));
  const sweepSeries = rows.map(r => toNum(r.sweep_value) / 64);
  const curatorSeries = rows.map(r => toNum(r.optimal_value) / 64);
  const offerSeries = rows.map(r => toNum(r.highest_offer_eth));

  const maxVal = Math.max(
    100,
    ...(marketSeries.length ? marketSeries : [0]),
    ...(sweepSeries.length ? sweepSeries : [0]),
    ...(curatorSeries.length ? curatorSeries : [0]),
    ...(offerSeries.length ? offerSeries : [0])
  );

  const buildPath = (series) => {
    const n = series.length;
    if (n === 0) return "";
    const stepX = 100 / Math.max(n - 1, 1);
    let d = "";
    for (let i = 0; i < n; i++) {
      const x = i * stepX;
      const y = 100 - Math.min(series[i] / maxVal, 1) * 100;
      d += i === 0 ? `M ${x},${y}` : ` L ${x},${y}`;
    }
    if (n === 1) {
      const x = 0;
      const y = 100 - Math.min(series[0] / maxVal, 1) * 100;
      d += ` L ${x},${y}`;
    }
    return d;
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
          Single Check VValue Overtime
        </p>
        <div style={{
          display: "flex",
          flexDirection: "column",
          height: "320px",
          alignItems: "flex-start",
          padding: "8px",
          width: "100%",
          flexShrink: 0
        }}>
          <div style={{
            flexBasis: 0,
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            alignItems: "flex-start",
            minHeight: "1px",
            minWidth: "1px",
            paddingBottom: "2px",
            paddingTop: 0,
            paddingLeft: 0,
            paddingRight: 0,
            width: "100%",
            flexShrink: 0
          }}>
            <div style={{
              flexBasis: 0,
              display: "flex",
              flexGrow: 1,
              alignItems: "center",
              marginBottom: "-2px",
              minHeight: "1px",
              minWidth: "1px",
              width: "100%",
              flexShrink: 0
            }}>
              <div style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: "Inter, sans-serif",
                fontWeight: 400,
                height: "100%",
                alignItems: "flex-end",
                justifyContent: "space-between",
                padding: "0 4px",
                flexShrink: 0,
                fontSize: "0.75em",
                color: "#7c7c7c",
                whiteSpace: "nowrap"
              }}>
                {yAxisLabels.map((label, idx) => (
                  <p key={idx} style={{ margin: 0 }}>{label}</p>
                ))}
              </div>
              <div style={{
                flexBasis: 0,
                flexGrow: 1,
                height: "100%",
                minHeight: "1px",
                minWidth: "1px",
                position: "relative",
                flexShrink: 0
              }}>
                {/* Grid lines */}
                <div style={{
                  position: "absolute",
                  display: "flex",
                  flexDirection: "column",
                  inset: 0,
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  padding: "6px 1px"
                }}>
                  {yAxisLabels.map((_, idx) => (
                    <div key={idx} style={{
                      height: 0,
                      width: "100%",
                      flexShrink: 0,
                      position: "relative"
                    }}>
                      <div style={{
                        position: "absolute",
                        top: "-1px",
                        right: idx === yAxisLabels.length - 1 ? 0 : "0.06%",
                        bottom: 0,
                        left: 0
                      }}>
                        <img 
                          alt="" 
                          src={idx === yAxisLabels.length - 1 ? imgLine1 : imgLine} 
                          style={{ width: "100%", height: "100%", display: "block" }}
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentElement.style.borderTop = "1px solid #333";
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Chart area with gradient and line */}
                <div style={{
                  position: "absolute",
                  inset: "7px 0"
                }}>
                  <div style={{
                    position: "absolute",
                    inset: "8% 4.05% 0 4.17%"
                  }}>
                    <div style={{
                      position: "absolute",
                      inset: "8% 4.17% 0 4.17%"
                    }}>
                      <img 
                        alt="" 
                        src={imgSingleLineArea0} 
                        style={{ width: "100%", height: "100%", display: "block" }}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    </div>
                    <div style={{
                      position: "absolute",
                      inset: "8% 4.17% 11% 4.17%"
                    }}>
                      <div style={{
                        position: "absolute",
                        inset: "-0.25% 0"
                      }}>
                        <img 
                          alt="" 
                          src={imgSingleLine0} 
                          style={{ width: "100%", height: "100%", display: "block" }}
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      </div>
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, zIndex: 2 }}>
                        <path d={buildPath(marketSeries)} fill="none" stroke="#069420" strokeWidth="0.8" />
                        <path d={buildPath(sweepSeries)} fill="none" stroke="#c97200" strokeWidth="0.8" />
                        <path d={buildPath(curatorSeries)} fill="none" stroke="#7086fd" strokeWidth="0.8" />
                        {marketSeries.map((v, i) => {
                          const n = marketSeries.length;
                          const stepX = 100 / Math.max(n - 1, 1);
                          const x = i * stepX;
                          const y = 100 - Math.min(v / maxVal, 1) * 100;
                          return <circle key={`m-${i}`} cx={x} cy={y} r={0.9} fill="#069420" />;
                        })}
                        {sweepSeries.map((v, i) => {
                          const n = sweepSeries.length;
                          const stepX = 100 / Math.max(n - 1, 1);
                          const x = i * stepX;
                          const y = 100 - Math.min(v / maxVal, 1) * 100;
                          return <circle key={`s-${i}`} cx={x} cy={y} r={0.9} fill="#c97200" />;
                        })}
                        {curatorSeries.map((v, i) => {
                          const n = curatorSeries.length;
                          const stepX = 100 / Math.max(n - 1, 1);
                          const x = i * stepX;
                          const y = 100 - Math.min(v / maxVal, 1) * 100;
                          return <circle key={`c-${i}`} cx={x} cy={y} r={0.9} fill="#7086fd" />;
                        })}
                        {offerSeries.map((v, i) => {
                          const n = offerSeries.length;
                          const stepX = 100 / Math.max(n - 1, 1);
                          const x = i * stepX;
                          const y = 100 - Math.min(v / maxVal, 1) * 100;
                          return <circle key={`o-${i}`} cx={x} cy={y} r={0.9} fill="#bbb" />;
                        })}
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* X-axis labels */}
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              marginBottom: "-2px",
              paddingBottom: "8px",
              paddingLeft: "29px",
              paddingRight: 0,
              paddingTop: 0,
              width: "100%",
              flexShrink: 0
            }}>
              {xAxisLabels.map((label, idx) => (
                <div key={idx} style={{
                  flexBasis: 0,
                  display: "flex",
                  flexDirection: "column",
                  flexGrow: 1,
                  alignItems: "flex-end",
                  minHeight: "1px",
                  minWidth: "1px",
                  flexShrink: 0
                }}>
                  <p style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 400,
                    fontSize: "0.75em",
                    color: "#7c7c7c",
                    margin: 0,
                    textAlign: "center",
                    width: "100%"
                  }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          {/* Legends */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0,
            alignItems: "flex-start",
            justifyContent: "center",
            overflow: "hidden",
            width: "100%",
            flexShrink: 0
          }}>
            {[
              { color: "#069420", label: "Market VValue", nodeImg: imgBasicNode },
              { color: "#c97200", label: "Sweep VValue", nodeImg: imgBasicNode1 },
              { color: "#7086fd", label: "Curator VValue", nodeImg: imgBasicNode2 }
            ].map((item, idx) => (
              <div key={idx} style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                padding: "0 8px",
                flexShrink: 0
              }}>
                <div style={{
                  display: "flex",
                  gap: "4px",
                  alignItems: "center",
                  overflow: "hidden",
                  padding: "4px",
                  flexShrink: 0
                }}>
                  <div style={{
                    width: "16px",
                    height: "16px",
                    flexShrink: 0,
                    position: "relative"
                  }}>
                    <div style={{
                      position: "absolute",
                      backgroundColor: item.color,
                      height: "2px",
                      left: 0,
                      top: "7px",
                      width: "16px"
                    }} />
                    <div style={{
                      position: "absolute",
                      left: "8px",
                      width: "1px",
                      height: "1px",
                      top: "8px"
                    }}>
                      <div style={{
                        position: "absolute",
                        inset: "-800% -700% -700% -800%"
                      }}>
                        <img 
                          alt="" 
                          src={item.nodeImg} 
                          style={{ width: "100%", height: "100%", display: "block" }}
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <p style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 400,
                    fontSize: "0.75em",
                    color: "#fff",
                    margin: 0,
                    whiteSpace: "nowrap"
                  }}>
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
