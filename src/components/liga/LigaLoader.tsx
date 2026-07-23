/**
 * Лоадер першого візиту (D-050): фірмовий мʼячик зі squash-відскоком
 * + опційні скелетони карток (структура видна ще до даних).
 * Показується лише коли кешу нема — далі все рендериться миттєво (D-049).
 */
export default function LigaLoader({ label = 'Секунду…', skeleton = false }: { label?: string; skeleton?: boolean }) {
  return (
    <div className="ld" role="status" aria-live="polite">
      <div className="ld-stage" aria-hidden>
        <div className="ld-ball" />
        <div className="ld-shadow" />
      </div>
      <p className="ld-txt">{label}</p>
      {skeleton && (
        <div className="ld-sk" aria-hidden>
          <div className="sk" style={{ height: 96 }} />
          <div className="sk" style={{ height: 140 }} />
          <div className="sk" style={{ height: 72 }} />
        </div>
      )}
    </div>
  );
}
