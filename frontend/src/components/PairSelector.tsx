"use client";

import { useEffect, useState } from "react";
import { getPublicClient, FACTORY_ABI, FACTORY_ADDRESS } from "@/lib/contract";
import { BASE_TOKEN_SYMBOL, QUOTE_TOKEN_SYMBOL } from "@/lib/config";

interface Pair {
  address: `0x${string}`;
  label: string;
}

interface Props {
  onSelect: (pairAddress: `0x${string}`) => void;
  selected: `0x${string}`;
}

export default function PairSelector({ onSelect, selected }: Props) {
  const [pairs, setPairs] = useState<Pair[]>([]);

  useEffect(() => {
    async function fetchPairs() {
      if ((FACTORY_ADDRESS as string) === "0x0000000000000000000000000000000000000000") return;
      try {
        const client = getPublicClient();
        const len = await client.readContract({
          address: FACTORY_ADDRESS as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: "allPairsLength",
        }) as bigint;

        const loaded: Pair[] = [];
        for (let i = 0n; i < len; i++) {
          const addr = await client.readContract({
            address: FACTORY_ADDRESS as `0x${string}`,
            abi: FACTORY_ABI,
            functionName: "allPairs",
            args: [i],
          }) as `0x${string}`;
          loaded.push({ address: addr, label: i === 0n ? `${BASE_TOKEN_SYMBOL}/${QUOTE_TOKEN_SYMBOL}` : `Pair #${i + 1n}` });
        }
        setPairs(loaded);
        if (loaded.length > 0 && !loaded.find((p) => p.address === selected)) {
          onSelect(loaded[0].address);
        }
      } catch (e) {
        console.error("PairSelector fetch:", e);
      }
    }
    fetchPairs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pairs.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#4a5578] font-mono">PAIR</span>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value as `0x${string}`)}
        className="text-sm bg-[#141622] border border-[#1a1f35] rounded-lg px-3 py-1.5 text-[#00f0ff] font-mono focus:outline-none focus:border-[#00f0ff]/50 transition-colors cursor-pointer"
      >
        {pairs.map((p) => (
          <option key={p.address} value={p.address}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
