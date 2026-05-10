import Link from "next/link";
import { CipherBookIcon } from "@/components/CipherBookIcon";

const CONTRACT_ADDRESS = "0x1369BAb501257C419d578d711331D79E27599472";

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const ZapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);

const FEATURES = [
  {
    icon: <LockIcon />,
    title: "Fully Encrypted Orders",
    desc: "Your price is encrypted with FHE before it leaves your browser. Nobody — not MEV bots, not validators, not even Zama — can read your open orders.",
  },
  {
    icon: <EyeOffIcon />,
    title: "Zero MEV & Front-Running",
    desc: "With no plaintext price data on-chain, sandwich attacks and front-running are cryptographically impossible. What bots can't see, they can't exploit.",
  },
  {
    icon: <ZapIcon />,
    title: "On-Chain FHE Matching",
    desc: "The smart contract compares encrypted prices using FHE.ge and FHE.select — order book matching happens entirely on-chain without decrypting anything.",
  },
  {
    icon: <KeyIcon />,
    title: "Only You Can Decrypt Yours",
    desc: "Each order's price is ACL-gated to your wallet address. Decrypt your own orders anytime using an EIP-712 signature — completely free and off-chain.",
  },
];

const STEPS = [
  { step: "01", title: "Place a limit order", desc: "Enter price and amount. FHE encryption runs in your browser before the transaction is sent — your price never leaves as plaintext." },
  { step: "02", title: "Order sits encrypted on-chain", desc: "Your order lives on Sepolia as a euint64 ciphertext. No one can read it — not even with full node access." },
  { step: "03", title: "Batch matching runs", desc: "Anyone calls runBatchMatch(). The contract compares encrypted prices using FHE.ge — crossing pairs are settled via the KMS." },
  { step: "04", title: "View your results", desc: "Sign a message with your wallet to decrypt your own prices. See remaining amount — if it's 0, your order filled." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen text-[#e2e8f0]">
      {/* Nav */}
      <nav className="border-b border-[#1a1f35] sticky top-0 z-10 bg-[#05070f]/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CipherBookIcon size={28} />
            <span className="font-bold text-[#e2e8f0] tracking-wide">CipherBook</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#374060] hover:text-[#00f0ff]/60 font-mono transition-colors hidden sm:block"
            >
              {CONTRACT_ADDRESS.slice(0, 6)}…{CONTRACT_ADDRESS.slice(-4)} ↗
            </a>
            <Link
              href="/app"
              className="px-4 py-2 bg-[#00f0ff] hover:bg-[#33f5ff] text-[#05070f] text-sm font-bold rounded-lg transition-colors"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-24 pb-28 text-center animate-fade-up">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00f0ff]/20 bg-[#00f0ff]/5 text-xs text-[#00f0ff]/80 mb-10 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
          Live on Ethereum Sepolia · Powered by Zama fhEVM
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
          Trade Privately.<br />
          <span className="text-[#00f0ff] text-glow">No MEV. No Front-Running.</span>
        </h1>

        <p className="text-base sm:text-lg text-[#8892b0] max-w-2xl mx-auto mb-10 leading-relaxed">
          CipherBook is the first fully encrypted limit order book DEX. Every order price
          is protected by Fully Homomorphic Encryption — matched on-chain without ever being revealed.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            href="/app"
            className="px-8 py-3.5 bg-[#00f0ff] hover:bg-[#33f5ff] text-[#05070f] font-bold rounded-xl transition-all text-base glow-cyan"
          >
            Launch App →
          </Link>
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="px-8 py-3.5 border border-[#1a1f35] hover:border-[#00f0ff]/30 text-[#8892b0] hover:text-[#e2e8f0] font-semibold rounded-xl transition-all text-base"
          >
            View Contract ↗
          </a>
        </div>

        {/* Code visualization */}
        <div className="mx-auto max-w-lg font-mono text-xs bg-[#0a0c14] border border-[#1a1f35] rounded-xl p-5 text-left mb-16">
          <div className="flex items-center gap-1.5 mb-4">
            <div className="w-3 h-3 rounded-full bg-[#ff3b6b]/70"/>
            <div className="w-3 h-3 rounded-full bg-[#ffd700]/70"/>
            <div className="w-3 h-3 rounded-full bg-[#00ff9d]/70"/>
            <span className="text-[#374060] text-xs ml-2">orderbook.sol — matchOrders()</span>
          </div>
          <div className="space-y-1.5 text-xs leading-relaxed">
            <div><span className="text-[#4a5578]">// standard DEX — price visible to anyone</span></div>
            <div>
              <span className="text-[#ff3b6b]">emit</span>{" "}
              OrderPlaced(<span className="text-[#ffd700]">price: 99</span>,{" "}
              <span className="text-[#ffd700]">amount: 50</span>)
              <span className="text-[#ff3b6b]/60"> ← MEV bot reads this</span>
            </div>
            <div className="mt-3"><span className="text-[#4a5578]">// CipherBook — price is a ciphertext</span></div>
            <div>
              <span className="text-[#00f0ff]">euint64</span> price ={" "}
              <span className="text-[#8892b0]">0x8f2a4c...e1</span>
              <span className="text-[#00ff9d]"> ← encrypted</span>
            </div>
            <div>
              <span className="text-[#00f0ff]">FHE.ge</span>(buyPrice, sellPrice)
              <span className="text-[#4a5578]"> // → ebool, never revealed</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
          {[
            ["8", "FHE operations"],
            ["27", "Tests passing"],
            ["0", "Plaintext leaks"],
          ].map(([val, label]) => (
            <div key={label} className="bg-[#0f111a] border border-[#1a1f35] rounded-xl p-4 hover:border-[#00f0ff]/20 transition-colors">
              <p className="text-2xl font-bold text-[#00f0ff] font-mono text-glow">{val}</p>
              <p className="text-xs text-[#4a5578] mt-1 font-mono">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[#1a1f35] bg-[#0a0c14]/50">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-2xl font-bold text-center mb-2 tracking-tight">Why CipherBook?</h2>
          <p className="text-center text-[#4a5578] text-sm mb-12 font-mono">The only DEX where MEV is cryptographically impossible.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-[#0f111a] border border-[#1a1f35] rounded-xl p-6 hover:border-[#00f0ff]/25 hover:bg-[#0f111a] transition-all group"
              >
                <div className="mb-3 text-[#00f0ff]/60 group-hover:text-[#00f0ff] transition-colors">{f.icon}</div>
                <h3 className="font-bold text-[#e2e8f0] mb-2">{f.title}</h3>
                <p className="text-sm text-[#8892b0] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[#1a1f35]">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-2xl font-bold text-center mb-2 tracking-tight">How It Works</h2>
          <p className="text-center text-[#4a5578] text-sm mb-12 font-mono">Four steps from order placement to private settlement.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.step} className="relative group">
                <div className="text-5xl font-black text-[#1a1f35] group-hover:text-[#00f0ff]/10 mb-3 font-mono transition-colors">{s.step}</div>
                <h3 className="font-bold text-[#e2e8f0] mb-2 text-sm">{s.title}</h3>
                <p className="text-xs text-[#8892b0] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#1a1f35] bg-[#0a0c14]/50">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1a1f35] text-xs text-[#4a5578] mb-6 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
            Sepolia testnet — no real funds required
          </div>
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Ready to trade privately?</h2>
          <p className="text-[#8892b0] mb-8 text-sm">Connect MetaMask on Sepolia and place your first encrypted limit order.</p>
          <Link
            href="/app"
            className="inline-block px-10 py-4 bg-[#00f0ff] hover:bg-[#33f5ff] text-[#05070f] font-bold rounded-xl transition-all text-base glow-cyan"
          >
            Open Trading App →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1f35]">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#374060] font-mono">
          <span>CipherBook — Built on Zama fhEVM · Developer Program Season 2</span>
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#00f0ff]/50 transition-colors"
          >
            {CONTRACT_ADDRESS} (Sepolia) ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
