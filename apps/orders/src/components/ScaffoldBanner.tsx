import React from 'react';

interface ScaffoldBannerProps {
  message: string;
  mode: 'real' | 'demo';
}

export function ScaffoldBanner({ message, mode }: ScaffoldBannerProps) {
  return <div className={`scaffold-banner ${mode}`}>{message}</div>;
}
