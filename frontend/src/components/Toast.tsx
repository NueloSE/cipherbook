"use client";

import { useEffect, useState, useCallback } from "react";

type ToastEntry = { id: number; message: string };

let _listeners: ((entry: ToastEntry) => void)[] = [];
let _nextId = 0;

export function toast(message: string) {
  const entry: ToastEntry = { id: _nextId++, message };
  _listeners.forEach((fn) => fn(entry));
}

export function Toaster() {
  const [entries, setEntries] = useState<ToastEntry[]>([]);

  const add = useCallback((entry: ToastEntry) => {
    setEntries((prev) => [...prev, entry]);
    setTimeout(() => {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    }, 3000);
  }, []);

  useEffect(() => {
    _listeners.push(add);
    return () => {
      _listeners = _listeners.filter((fn) => fn !== add);
    };
  }, [add]);

  if (entries.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {entries.map((e) => (
        <div
          key={e.id}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-sm px-4 py-2.5 rounded-lg shadow-lg animate-fade-in"
        >
          {e.message}
        </div>
      ))}
    </div>
  );
}
