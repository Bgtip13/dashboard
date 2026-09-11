"use client";
import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export default function CountUp({
  value, format, className,
}: { value: number; format?: (n: number) => string; className?: string }) {
  const [v, setV] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    const controls = animate(first.current ? 0 : v, value, {
      duration: first.current ? 1.4 : 0.8, ease: "easeOut", onUpdate: setV,
    });
    first.current = false;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className={className}>{format ? format(v) : Math.round(v).toLocaleString("id-ID")}</span>;
}
