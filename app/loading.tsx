'use client';

import React from 'react';
import { Activity } from 'lucide-react';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-[4px] border-4 border-blue-100 animate-pulse" />
          <Activity className="absolute inset-0 m-auto h-8 w-8 text-blue-600 animate-pulse" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Node Synchronizing</p>
          <div className="flex gap-1 justify-center">
            <div className="h-1 w-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="h-1 w-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="h-1 w-1 bg-blue-600 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
}
