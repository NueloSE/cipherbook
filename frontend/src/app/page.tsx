import Link from "next/link";
import { CipherBookIcon } from "@/components/CipherBookIcon";

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const ZapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);

const FEATURES = [
  {
    icon: <LockIcon />,
    title: "Fully Encrypted Orders",
    desc: "Your price and amount are encrypted with FHE before they leave your browser. Nobody — not MEV bots, not other traders, not even the validator — can read your open orders.",
  },
  {
    icon: <EyeOffIcon />,
    title: "Zero MEV & Front-Running",
    desc: "With no plaintext order data on-chain, sandwich attacks and front-running are cryptographically impossible. What MEV bots can't see, they can't exploit.",
  },
  {
    icon: <ZapIcon />,
    title: "On-Chain Matching",
    desc: "The smart contract runs encrypted comparisons using Zama's fhEVM — FHE.ge, FHE.min, FHE.select — to match orders entirely on-chain without decrypting anything.",
  },
  {
    icon: <KeyIcon />,
    title: "Only You Can Decrypt Yours",
    desc: "Each order's price and amount are ACL-gated to your wallet. Decrypt your own orders anytime using an EIP-712 signature — no one else can.",
  },
];

const STEPS = [
  { step: "01", title: "Place a limit order", desc: "Enter your price and amount. FHE encryption happens in your browser before the transaction is sent." },
  { step: "02", title: "Orders sit encrypted on-chain", desc: "Your order lives on Sepolia as a euint64 ciphertext. No one can read it." },
  { step: "03", title: "Batch matching runs", desc: "Anyone calls runBatchMatch(). The contract compares encrypted prices and updates encrypted remaining amounts — no decryption." },
  { step: "04", title: "View your results", desc: "Sign a message with your wallet to decrypt your own order details. See your remaining amount — if it's 0, you filled." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800/60 sticky top-0 z-10 bg-gray-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CipherBookIcon size={28} />
            <span className="font-bold text-white">CipherBook</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://sepolia.etherscan.io/address/0x1369BAb501257C419d578d711331D79E27599472"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 font-mono transition-colors hidden sm:block"
            >
              0xc511…d8
            </a>
            <Link
              href="/app"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold rounded-lg transition-colors"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-800 bg-indigo-950/50 text-xs text-indigo-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Live on Ethereum Sepolia · Powered by Zama fhEVM
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight">
          Trade Privately.<br />
          <span className="text-indigo-400">No MEV. No Front-Running.</span>
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          CipherBook is the first fully encrypted limit order book DEX. Every order price and amount
          is protected by Fully Homomorphic Encryption — matched on-chain without ever being revealed.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/app"
            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors text-base"
          >
            Launch App →
          </Link>
          <a
            href="https://sepolia.etherscan.io/address/0x1369BAb501257C419d578d711331D79E27599472"
            target="_blank"
            rel="noreferrer"
            className="px-8 py-3.5 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold rounded-xl transition-colors text-base"
          >
            View Contract
          </a>
        </div>

        {/* Stat bar */}
        <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto">
          {[
            ["9", "FHE operations used"],
            ["20 / 20", "Tests passing"],
            ["0", "Plaintext leaks"],
          ].map(([val, label]) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-2xl font-bold text-indigo-400">{val}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-800 bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-2xl font-bold text-center mb-12">Why CipherBook?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="mb-3 text-indigo-400">{f.icon}</div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.step} className="relative">
                <div className="text-4xl font-black text-gray-800 mb-3">{s.step}</div>
                <h3 className="font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-800 bg-linear-to-b from-gray-900/50 to-gray-950">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to trade privately?</h2>
          <p className="text-gray-400 mb-8">Connect your MetaMask on Sepolia and place your first encrypted limit order.</p>
          <Link
            href="/app"
            className="inline-block px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors text-base"
          >
            Open Trading App →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
          <span>CipherBook — Built on Zama fhEVM · Zama Developer Program Season 2</span>
          <span>Contract: 0x1369BAb501257C419d578d711331D79E27599472 (Sepolia)</span>
        </div>
      </footer>
    </div>
  );
}
