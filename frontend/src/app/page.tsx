import Link from "next/link";
import { CipherBookIcon } from "@/components/CipherBookIcon";

const CONTRACT_ADDRESS = "0x1369BAb501257C419d578d711331D79E27599472";

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 h-14">
        <div
          className="absolute inset-0 border-b border-white/5"
          style={{ background: "rgba(2,4,8,0.75)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CipherBookIcon size={22} />
            <span className="font-bold text-white text-sm tracking-wide">CipherBook</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="hidden sm:block text-xs text-white/30 hover:text-white/70 transition-colors font-mono"
            >
              How it works
            </a>
            <a
              href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:block text-xs text-white/20 hover:text-[#00f0ff]/50 font-mono transition-colors"
            >
              {CONTRACT_ADDRESS.slice(0, 6)}…{CONTRACT_ADDRESS.slice(-4)} ↗
            </a>
            <Link
              href="/app"
              className="btn-cyan text-xs px-4 py-2 rounded-lg font-bold"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col justify-center pt-14">
        {/* Multi-layer ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: [
              "radial-gradient(80% 60% at 20% 50%, rgba(0,240,255,0.06) 0%, transparent 60%)",
              "radial-gradient(60% 80% at 80% 20%, rgba(0,100,255,0.05) 0%, transparent 60%)",
              "radial-gradient(40% 40% at 50% 100%, rgba(0,240,255,0.04) 0%, transparent 70%)",
            ].join(", "),
          }}
        />
        {/* Subtle grid lines */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(0,240,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,1) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />

        <div className="max-w-6xl mx-auto px-6 w-full text-center flex flex-col items-center">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/8 bg-white/3 text-[11px] text-[#00f0ff]/60 mb-10 font-mono animate-fade-up [animation-delay:0ms]">
              <span className="dot-live" />
              Live on Ethereum Sepolia · Powered by fhEVM
            </div>

            {/* Headline */}
            <h1 className="font-black tracking-tight leading-[1.0] mb-8 animate-fade-up [animation-delay:80ms]">
              <span className="block text-white/90" style={{ fontSize: "clamp(42px, 7vw, 88px)" }}>
                Your limit orders are
              </span>
              <span
                className="block text-gradient"
                style={{ fontSize: "clamp(48px, 8.5vw, 108px)" }}
              >
                invisible to everyone.
              </span>
            </h1>

            {/* Subtext */}
            <p className="text-white/40 leading-relaxed mb-10 animate-fade-up [animation-delay:160ms]" style={{ fontSize: "clamp(15px, 1.5vw, 19px)", maxWidth: "560px" }}>
              CipherBook uses Fully Homomorphic Encryption to keep your prices
              encrypted on-chain. MEV bots see nothing. Validators see nothing.
              Nobody sees anything.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap justify-center gap-3 mb-16 animate-fade-up [animation-delay:220ms]">
              <Link
                href="/app"
                className="btn-cyan px-8 py-3.5 rounded-xl text-base font-bold"
              >
                Start Trading Privately →
              </Link>
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="btn-outline px-8 py-3.5 rounded-xl text-base font-semibold"
              >
                View Contract ↗
              </a>
            </div>

            {/* Proof pills */}
            <div className="flex flex-wrap justify-center gap-3 animate-fade-up [animation-delay:280ms]">
              {[
                { n: "8", label: "FHE operations per match" },
                { n: "27", label: "tests passing" },
                { n: "0", label: "plaintext price leaks" },
              ].map(({ n, label }) => (
                <div
                  key={label}
                  className="flex items-baseline gap-2 px-4 py-2 rounded-xl border border-white/8 bg-white/2 font-mono"
                >
                  <span className="text-xl font-black text-gradient-static">{n}</span>
                  <span className="text-xs text-white/30">{label}</span>
                </div>
              ))}
            </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in [animation-delay:600ms]">
          <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </section>

      {/* ── The Comparison ── */}
      <section className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-24">
          {/* Label */}
          <p className="text-[10px] font-mono text-[#00f0ff]/40 uppercase tracking-widest text-center mb-16">
            The difference
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Standard DEX — danger */}
            <div
              className="relative rounded-2xl overflow-hidden p-6"
              style={{
                background: "linear-gradient(135deg, rgba(255,60,70,0.05) 0%, rgba(255,60,70,0.02) 100%)",
                border: "1px solid rgba(255,60,70,0.15)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-mono text-[#ff3b6b]/50 uppercase tracking-widest mb-1">Standard DEX</p>
                  <p className="text-sm font-bold text-white/60">Your orders are exposed</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ff3b6b]/10 border border-[#ff3b6b]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ff3b6b] animate-pulse" />
                  <span className="text-[10px] font-mono text-[#ff3b6b]/70">Vulnerable</span>
                </div>
              </div>

              {/* Code block */}
              <div className="rounded-xl p-4 font-mono text-xs space-y-1.5" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,60,70,0.1)" }}>
                <div className="text-white/20">// Transaction mempool — publicly visible</div>
                <div className="text-white/50">
                  <span className="text-[#ff3b6b]">emit</span> OrderPlaced&#40;
                </div>
                <div className="pl-4 text-[#ffd700]">price: 99,</div>
                <div className="pl-4 text-[#ffd700]">amount: 50,</div>
                <div className="pl-4 text-[#ffd700]">side: BUY</div>
                <div className="text-white/50">&#41;</div>
              </div>

              {/* MEV bot alert */}
              <div
                className="mt-4 rounded-xl p-3.5 flex items-start gap-3"
                style={{ background: "rgba(255,60,70,0.08)", border: "1px solid rgba(255,60,70,0.2)" }}
              >
                <div className="mt-0.5 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff3b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#ff3b6b]/90 mb-0.5">MEV bot intercepted</p>
                  <p className="text-[11px] text-[#ff3b6b]/50 font-mono">Sandwich attack executing at price: 98 → 100</p>
                </div>
              </div>
            </div>

            {/* CipherBook — safe */}
            <div
              className="relative rounded-2xl overflow-hidden p-6"
              style={{
                background: "linear-gradient(135deg, rgba(0,240,255,0.05) 0%, rgba(0,100,255,0.02) 100%)",
                border: "1px solid rgba(0,240,255,0.12)",
              }}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-8 right-8 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(0,240,255,0.3), transparent)" }}
              />

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-mono text-[#00f0ff]/50 uppercase tracking-widest mb-1">CipherBook</p>
                  <p className="text-sm font-bold text-white/80">Your orders are invisible</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
                  <span className="text-[10px] font-mono text-[#00f0ff]/70">Protected</span>
                </div>
              </div>

              {/* Code block */}
              <div className="rounded-xl p-4 font-mono text-xs space-y-1.5" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,240,255,0.08)" }}>
                <div className="text-white/20">// On-chain — ciphertext, unreadable</div>
                <div>
                  <span className="text-[#00f0ff]">euint64</span>
                  <span className="text-white/50"> price = </span>
                  <span className="text-white/35">0x8f2a…e1</span>
                </div>
                <div className="text-white/20 mt-1">// FHE comparison — never decrypts</div>
                <div>
                  <span className="text-[#00f0ff]">FHE.ge</span>
                  <span className="text-white/50">(buyPrice, sellPrice)</span>
                </div>
                <div className="pl-4 text-white/30">→ <span className="text-[#00f0ff]/60">ebool</span> // stays encrypted</div>
              </div>

              {/* Shield confirmation */}
              <div
                className="mt-4 rounded-xl p-3.5 flex items-start gap-3"
                style={{ background: "rgba(0,240,255,0.05)", border: "1px solid rgba(0,240,255,0.15)" }}
              >
                <div className="mt-0.5 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#00f0ff]/80 mb-0.5">MEV bot: nothing to see</p>
                  <p className="text-[11px] text-[#00f0ff]/40 font-mono">Price encrypted until settlement. Mathematically unreadable.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features bento ── */}
      <section className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <p className="text-[10px] font-mono text-[#00f0ff]/40 uppercase tracking-widest text-center mb-4">
            Why CipherBook
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-4 tracking-tight">
            Built to be cryptographically unfair
            <br />
            <span className="text-white/40">to MEV bots.</span>
          </h2>
          <p className="text-center text-white/25 text-sm mb-14 max-w-md mx-auto leading-relaxed">
            Every design decision optimizes for one outcome: your orders stay invisible until they need to settle.
          </p>

          {/* Bento grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Hero card — spans 2 cols on lg */}
            <div
              className="lg:col-span-2 panel relative rounded-2xl p-8 overflow-hidden group cursor-default"
              style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.06) 0%, rgba(0,0,0,0) 60%)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(60% 60% at 30% 40%, rgba(0,240,255,0.06), transparent)" }}
              />
              <div className="relative z-10">
                <div className="mb-5 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(0,240,255,0.1)", border: "1px solid rgba(0,240,255,0.2)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <p className="text-[10px] font-mono text-[#00f0ff]/40 uppercase tracking-widest mb-2">Core feature</p>
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Fully Encrypted Orders</h3>
                <p className="text-white/40 leading-relaxed max-w-md" style={{ fontSize: "14px" }}>
                  Your price is FHE-encrypted in your browser before the transaction is sent. The ciphertext lives on Sepolia as a <code className="text-[#00f0ff]/60 bg-white/5 px-1 py-0.5 rounded text-[11px] font-mono">euint64</code> — unreadable to MEV bots, validators, and even the Zama team.
                </p>
                <div className="mt-6 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-[#00f0ff]/20 to-transparent" />
                  <span className="text-[10px] font-mono text-white/20">Powered by Zama fhEVM</span>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div
              className="panel relative rounded-2xl p-6 overflow-hidden group cursor-default"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="mb-5 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.2)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4757" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </div>
              <h3 className="font-bold text-white mb-2 text-sm">Zero MEV</h3>
              <p className="text-white/35 leading-relaxed" style={{ fontSize: "13px" }}>
                No plaintext price means sandwich attacks are cryptographically impossible. What bots can't see, they can't exploit.
              </p>
            </div>

            {/* Card 3 */}
            <div
              className="panel relative rounded-2xl p-6 overflow-hidden group cursor-default"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="mb-5 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,214,143,0.1)", border: "1px solid rgba(0,214,143,0.2)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d68f" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <h3 className="font-bold text-white mb-2 text-sm">On-Chain FHE Matching</h3>
              <p className="text-white/35 leading-relaxed" style={{ fontSize: "13px" }}>
                <code className="text-[#00f0ff]/60 text-[11px] font-mono">FHE.ge</code> and <code className="text-[#00f0ff]/60 text-[11px] font-mono">FHE.select</code> compare encrypted prices entirely on-chain. The match result is an encrypted boolean — never revealed.
              </p>
            </div>

            {/* Card 4 */}
            <div
              className="panel relative rounded-2xl p-6 overflow-hidden group cursor-default"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="mb-5 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(180,130,255,0.1)", border: "1px solid rgba(180,130,255,0.2)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b482ff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
              </div>
              <h3 className="font-bold text-white mb-2 text-sm">Only You Can Decrypt</h3>
              <p className="text-white/35 leading-relaxed" style={{ fontSize: "13px" }}>
                Each price is ACL-gated to your wallet. Decrypt your own orders via a free EIP-712 signature — completely off-chain, no gas.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <p className="text-[10px] font-mono text-[#00f0ff]/40 uppercase tracking-widest text-center mb-4">
            The flow
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-4 tracking-tight">
            Four steps. Total privacy.
          </h2>
          <p className="text-center text-white/25 text-sm mb-16 max-w-md mx-auto">
            No plaintext ever touches the chain. From placement to settlement, your price stays yours.
          </p>

          <div className="relative">
            {/* Connecting line (desktop) */}
            <div
              className="hidden lg:block absolute top-8 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent 4%, rgba(0,240,255,0.15) 20%, rgba(0,240,255,0.15) 80%, transparent 96%)" }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
              {[
                {
                  n: "01",
                  title: "Place a limit order",
                  desc: "Enter your price and amount. FHE encryption runs locally in your browser — the price never leaves as plaintext.",
                  color: "#00f0ff",
                },
                {
                  n: "02",
                  title: "Order lives on-chain encrypted",
                  desc: "Your order is stored as a euint64 ciphertext on Sepolia. No one can read it — not even with full validator access.",
                  color: "#00d68f",
                },
                {
                  n: "03",
                  title: "FHE batch matching",
                  desc: "Anyone calls runBatchMatch(). The contract uses FHE.ge to compare prices — a match produces an encrypted boolean result.",
                  color: "#b482ff",
                },
                {
                  n: "04",
                  title: "Private settlement",
                  desc: "Sign a free off-chain message to decrypt your own price. If remaining = 0, your order filled. Withdraw unused escrow anytime.",
                  color: "#ffd700",
                },
              ].map(({ n, title, desc, color }) => (
                <div key={n} className="relative group">
                  {/* Step number badge */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:-translate-y-1"
                    style={{
                      background: `rgba(${color === "#00f0ff" ? "0,240,255" : color === "#00d68f" ? "0,214,143" : color === "#b482ff" ? "180,130,255" : "255,215,0"},0.08)`,
                      border: `1px solid ${color}25`,
                    }}
                  >
                    <span className="font-black font-mono text-lg" style={{ color }}>{n}</span>
                  </div>
                  <h3 className="font-bold text-white mb-2 text-sm leading-snug">{title}</h3>
                  <p className="text-xs text-white/30 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Technical proof ── */}
      <section className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[10px] font-mono text-[#00f0ff]/40 uppercase tracking-widest mb-4">The math</p>
            <h2 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight">
              Not privacy by policy.
              <br />
              <span className="text-white/40">Privacy by mathematics.</span>
            </h2>
            <p className="text-white/30 text-sm mb-12 leading-relaxed">
              FHE lets the contract evaluate conditions on ciphertext without ever decrypting. The matching result is computed over encrypted inputs and remains encrypted until the KMS releases it post-settlement.
            </p>
          </div>

          {/* FHE equation card */}
          <div
            className="max-w-2xl mx-auto rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(0,240,255,0.1)", background: "rgba(0,0,0,0.4)" }}
          >
            {/* Terminal header */}
            <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-white/5">
              <div className="w-3 h-3 rounded-full" style={{ background: "rgba(255,60,70,0.5)" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "rgba(255,215,0,0.5)" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "rgba(0,214,143,0.5)" }} />
              <span className="ml-3 text-[11px] font-mono text-white/20">CipherBook.sol — runBatchMatch()</span>
            </div>
            {/* Code */}
            <div className="p-5 font-mono text-xs leading-6 space-y-1">
              <div className="text-white/25">{"// Compare encrypted prices — no decryption needed"}</div>
              <div>
                <span className="text-[#00f0ff]">ebool</span>
                <span className="text-white/60"> canFill = </span>
                <span className="text-[#00f0ff]">FHE.ge</span>
                <span className="text-white/50">(buy.encPrice, sell.encPrice);</span>
              </div>
              <div className="mt-2 text-white/25">{"// Select trade quantity — result stays encrypted"}</div>
              <div>
                <span className="text-[#00f0ff]">euint64</span>
                <span className="text-white/60"> tradeQty = </span>
                <span className="text-[#00f0ff]">FHE.select</span>
                <span className="text-white/50">(canFill, qty, zero);</span>
              </div>
              <div className="mt-2 text-white/25">{"// Make trade qty publicly decryptable by KMS"}</div>
              <div>
                <span className="text-[#00f0ff]">FHE.makePubliclyDecryptable</span>
                <span className="text-white/50">(tradeQty);</span>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-white/5 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,240,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span className="text-[10px] font-mono text-white/20">
                Prices never leave encrypted form until the KMS settles post-match
              </span>
            </div>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-10">
            {[
              { n: "8", sub: "FHE operations" },
              { n: "27", sub: "tests passing" },
              { n: "0", sub: "plaintext leaks" },
            ].map(({ n, sub }) => (
              <div
                key={sub}
                className="text-center py-5 px-4 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-3xl font-black font-mono text-gradient-static mb-1">{n}</div>
                <div className="text-[10px] font-mono text-white/25 uppercase tracking-widest">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-white/5">
        <div className="relative overflow-hidden">
          {/* Dramatic glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                "radial-gradient(60% 100% at 50% 100%, rgba(0,240,255,0.08) 0%, transparent 70%)",
                "radial-gradient(30% 50% at 20% 50%, rgba(0,100,255,0.04) 0%, transparent 70%)",
              ].join(", "),
            }}
          />
          <div className="relative max-w-4xl mx-auto px-6 py-32 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/6 text-[11px] text-white/20 mb-8 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
              Sepolia testnet · No real funds required
            </div>
            <h2 className="font-black tracking-tight leading-[1.05] mb-6">
              <span className="block text-white/80" style={{ fontSize: "clamp(32px, 5vw, 56px)" }}>
                Trade in the dark.
              </span>
              <span className="block text-gradient" style={{ fontSize: "clamp(38px, 6vw, 72px)" }}>
                Win in the clear.
              </span>
            </h2>
            <p className="text-white/30 mb-10 max-w-md mx-auto leading-relaxed" style={{ fontSize: "15px" }}>
              Connect MetaMask on Sepolia and place your first FHE-encrypted limit order.
              The entire experience takes under 60 seconds.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/app"
                className="btn-cyan px-10 py-4 rounded-2xl text-base font-bold w-full sm:w-auto"
              >
                Open Trading App →
              </Link>
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="btn-outline px-10 py-4 rounded-2xl text-base font-semibold w-full sm:w-auto"
              >
                View on Etherscan ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/15 font-mono">
          <div className="flex items-center gap-2">
            <CipherBookIcon size={16} />
            <span>CipherBook — Built on fhEVM · Ethereum Sepolia</span>
          </div>
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#00f0ff]/40 transition-colors"
          >
            {CONTRACT_ADDRESS} (Sepolia) ↗
          </a>
        </div>
      </footer>

    </div>
  );
}
