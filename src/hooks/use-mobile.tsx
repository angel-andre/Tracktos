import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const computeIsMobile = () => mql.matches;

    const onChange = () => {
      setIsMobile(computeIsMobile());
    };

    // Initial state
    setIsMobile(computeIsMobile());

    // Support older browsers (Safari <14) that use addListener/removeListener
    try {
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
      } else if (typeof (mql as any).addListener === "function") {
        (mql as any).addListener(onChange);
        return () => (mql as any).removeListener(onChange);
      }
    } catch (_) {
      // No-op: if matchMedia listeners fail, rely on initial value
    }

    // Fallback: listen to window resize
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return !!isMobile;
}
