import { useEffect, useRef, useState } from 'react';

/** Đếm ngược số giây còn lại của lượt giữ chỗ */
export function useCountdown(secondsLeft: number | null, startedAt: number, onEnd: () => void): number | null {
  const [now, setNow] = useState(() => Date.now());
  const endedFor = useRef<string | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (secondsLeft === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, startedAt]);

  const remaining = secondsLeft === null ? null : Math.max(0, secondsLeft - Math.floor((now - startedAt) / 1000));

  useEffect(() => {
    if (remaining !== 0) return;
    const report = `${secondsLeft}:${startedAt}`;
    if (endedFor.current === report) return;
    endedFor.current = report;
    onEndRef.current();
  }, [remaining, secondsLeft, startedAt]);

  return remaining;
}
