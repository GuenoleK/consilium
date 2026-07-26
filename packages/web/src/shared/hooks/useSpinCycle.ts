import { useCallback, useState } from "react";

const wait = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));

export function useSpinCycle(cycleDuration = 700) {
  const [spinning, setSpinning] = useState(false);

  const runSpinCycle = useCallback(async (action: () => Promise<void>) => {
    if (spinning) return;
    const startedAt = performance.now();
    setSpinning(true);

    try {
      await action();
    } finally {
      const elapsed = performance.now() - startedAt;
      const currentCycleElapsed = elapsed % cycleDuration;
      const remaining = elapsed < cycleDuration
        ? cycleDuration - elapsed
        : currentCycleElapsed < 16 ? 0 : cycleDuration - currentCycleElapsed;
      if (remaining > 0) await wait(remaining);
      setSpinning(false);
    }
  }, [cycleDuration, spinning]);

  return { spinning, runSpinCycle };
}
