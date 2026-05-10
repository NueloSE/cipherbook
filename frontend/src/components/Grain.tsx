/**
 * Fixed full-screen grain overlay. Adds tactile noise so the dark canvas
 * never reads as flat. pointer-events-none so it never intercepts clicks.
 */
export function Grain() {
  return (
    <div
      aria-hidden
      className="grain-noise pointer-events-none fixed inset-0 z-[100]"
    />
  );
}
