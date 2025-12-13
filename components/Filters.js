import React from "react";

export default function Filters({ state, onChange, options, priceRange }) {
  const set = (k, v) => onChange({ ...state, [k]: v });
  const srcs = options?.sources || ["opensea", "tokenworks"];
  const checks = options?.checks || ["", "80", "40", "20", "10", "5", "4", "1"];
  const days = options?.days || [""];
  const bands = options?.color_band || [""];
  const shifts = options?.shift || [""];
  const speeds = options?.speed || [""];
  const gradients = options?.gradient || [""];
  const minP = priceRange?.min ?? 0;
  const maxP = priceRange?.max ?? 100;
  const curMin = state.minPrice !== undefined && state.minPrice !== "" ? Number(state.minPrice) : minP;
  const curMax = state.maxPrice !== undefined && state.maxPrice !== "" ? Number(state.maxPrice) : maxP;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, alignItems: "center", marginBottom: 16 }}>
      <div>
        <label style={{ display: "block", fontSize: 12 }}>Source</label>
        <select value={state.source || ""} onChange={e => set("source", e.target.value)} style={{ width: "100%" }}>
          <option value="">All</option>
          {srcs.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12 }}>Price Min ({curMin} ETH)</label>
        <input type="range" min={minP} max={maxP} step={0.01} value={curMin} onChange={e => set("minPrice", e.target.value)} style={{ width: "100%" }} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12 }}>Price Max ({curMax} ETH)</label>
        <input type="range" min={minP} max={maxP} step={0.01} value={curMax} onChange={e => set("maxPrice", e.target.value)} style={{ width: "100%" }} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12 }}>Checks</label>
        <select value={state.checks || ""} onChange={e => set("checks", e.target.value)} style={{ width: "100%" }}>
          <option value="">Any</option>
          {checks.map(v => (
            <option key={String(v)} value={String(v)}>{String(v)}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12 }}>Day</label>
        <select value={state.day || ""} onChange={e => set("day", e.target.value)} style={{ width: "100%" }}>
          <option value="">Any</option>
          {days.map(v => (
            <option key={String(v)} value={String(v)}>{String(v)}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12 }}>Band</label>
        <select value={state.color_band || ""} onChange={e => set("color_band", e.target.value)} style={{ width: "100%" }}>
          <option value="">Any</option>
          {bands.map(v => (
            <option key={String(v)} value={String(v)}>{String(v)}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12 }}>Shift</label>
        <select value={state.shift || ""} onChange={e => set("shift", e.target.value)} style={{ width: "100%" }}>
          <option value="">Any</option>
          {shifts.map(v => (
            <option key={String(v)} value={String(v)}>{String(v)}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12 }}>Speed</label>
        <select value={state.speed || ""} onChange={e => set("speed", e.target.value)} style={{ width: "100%" }}>
          <option value="">Any</option>
          {speeds.map(v => (
            <option key={String(v)} value={String(v)}>{String(v)}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12 }}>Gradient</label>
        <select value={state.gradient || ""} onChange={e => set("gradient", e.target.value)} style={{ width: "100%" }}>
          <option value="">Any</option>
          {gradients.map(v => (
            <option key={String(v)} value={String(v)}>{String(v)}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12 }}>Sort</label>
        <select value={state.sort || "price_asc"} onChange={e => set("sort", e.target.value)} style={{ width: "100%" }}>
          <option value="price_asc">Low → High price</option>
          <option value="price_desc">High → Low price</option>
          <option value="checks_desc">Checks value</option>
          <option value="band_desc">Band values descending</option>
        </select>
      </div>
    </div>
  );
}
