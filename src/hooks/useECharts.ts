import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

export function useECharts(option: EChartsOption, deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current);
    chart.current = c;
    const onResize = () => c.resize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); c.dispose(); chart.current = null; };
  }, []);

  useEffect(() => {
    // notMerge: option baru MENGGANTIKAN penuh (series lama ikut terhapus saat filter berubah)
    chart.current?.setOption(option, { notMerge: true, lazyUpdate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
