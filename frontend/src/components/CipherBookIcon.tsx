export function CipherBookIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="#060d1f"/>
      <path d="M16 26V8" stroke="#00c8d8" strokeWidth="1.8"/>
      <path d="M16 8C13 5 5 5 3 7v17c2-2 10-2 13 1z" fill="#00c8d8" fillOpacity="0.85"/>
      <path d="M16 8c3-3 11-3 13-1v17c-2-2-10-2-13 1z" fill="#00f0ff" fillOpacity="0.6"/>
      <rect x="12" y="18" width="8" height="6" rx="1.5" fill="#00f0ff"/>
      <path d="M13.8 18v-1.8a2.2 2.2 0 1 1 4.4 0V18" stroke="#05070f" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}
