import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background: "#f5f1e8" }}>
      <div style={{ position: "absolute", left: 23, top: 22, color: "#111111", fontSize: 126, fontWeight: 900, lineHeight: 1 }}>D</div>
      <div style={{ position: "absolute", right: 19, bottom: 18, width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#111111" }}>
        <div style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid #f5f1e8", borderRadius: "50%" }}>
          <div style={{ width: 15, height: 15, borderRadius: "50%", background: "#e84b32" }} />
        </div>
      </div>
    </div>,
    size,
  );
}