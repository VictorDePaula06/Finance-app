import { useEffect, useRef, useState } from 'react';

/**
 * Número financeiro com contagem suave (count-up) até o valor atual.
 * Puramente visual: renderiza exatamente o mesmo texto do `format`, só anima
 * a transição. Respeita prefers-reduced-motion. Não altera layout nem lógica.
 *
 * Uso: <AnimatedNumber value={1234.5} format={formatCurrency} className="..." />
 */
export default function AnimatedNumber({
  value = 0,
  format = (v) => String(v),
  duration = 650,
  className = '',
  as: Tag = 'span',
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const to = Number(value) || 0;
    const from = fromRef.current;
    const reduce = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return undefined;
    }

    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <Tag className={className}>{format(display)}</Tag>;
}
