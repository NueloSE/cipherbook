import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="7" fill="#312e81"/><path d="M16 26V8" stroke="#6366f1" stroke-width="2"/><path d="M16 8C13 5 5 5 3 7v17c2-2 10-2 13 1z" fill="#6366f1"/><path d="M16 8c3-3 11-3 13-1v17c-2-2-10-2-13 1z" fill="#818cf8"/><rect x="12" y="18" width="8" height="6" rx="1.5" fill="white"/><path d="M13.8 18v-1.8a2.2 2.2 0 1 1 4.4 0V18" stroke="white" stroke-width="1.7" stroke-linecap="round"/></svg>`;

  return new ImageResponse(
    <div style={{ width: 32, height: 32, display: "flex" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img width={32} height={32} src={`data:image/svg+xml,${encodeURIComponent(svg)}`} alt="" />
    </div>,
    { ...size },
  );
}
