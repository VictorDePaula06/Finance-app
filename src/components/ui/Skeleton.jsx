/**
 * Bloco de carregamento (shimmer) reutilizável. Usa a classe global
 * `.alv-skeleton` definida no index.css. Puramente visual.
 *
 * Uso: <Skeleton className="h-6 w-24" />  (defina tamanho via classes/estilo)
 */
export default function Skeleton({ className = '', style, rounded = '0.75rem' }) {
  return (
    <span
      aria-hidden="true"
      className={`alv-skeleton ${className}`}
      style={{ display: 'block', borderRadius: rounded, ...style }}
    />
  );
}
