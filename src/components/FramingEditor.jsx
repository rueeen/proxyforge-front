import { useEffect, useId, useRef, useState } from "react";
import ProxyCard from "./ProxyCard";
import "./FramingEditor.css";

function savedFraming(deckCard) {
  return {
    offset: deckCard.generated_image?.framing_offset_y ?? 0,
    zoom: deckCard.generated_image?.framing_zoom ?? 100,
  };
}

export default function FramingEditor({ deckCard, symbols, layout, busy, onSave, onAuto, onClose }) {
  const [framing, setFraming] = useState(() => savedFraming(deckCard));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const titleId = useId();
  const blocked = busy || working;
  const source = deckCard.generated_image?.framing_source || "default";
  const sourceNames = { auto: "Automático", manual: "Manual", default: "Por defecto" };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (!dialogRef.current.contains(document.activeElement) || document.activeElement?.disabled) {
      dialogRef.current.focus();
    }
  }, [blocked]);

  async function run(action) {
    if (blocked) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      if (action === "auto") {
        const updated = await onAuto();
        setFraming(savedFraming(updated));
      } else {
        await onSave(framing);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "No se pudo ajustar el encuadre.");
    } finally {
      setWorking(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!blocked) {
        onClose();
      }
    } else if (["ArrowUp", "ArrowDown"].includes(event.key) && !blocked) {
      event.preventDefault();
      const delta = (event.key === "ArrowDown" ? 1 : -1) * (event.shiftKey ? 5 : 1);
      setFraming((current) => ({ ...current, offset: Math.min(35, Math.max(-20, current.offset + delta)) }));
    } else if (event.key === "Tab") {
      const controls = [...dialogRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled)")];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div className="framing-overlay">
      <section
        className="framing-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={blocked}
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="framing-header">
          <h2 id={titleId}>Encuadre</h2>
          <button type="button" className="secondary-button" disabled={blocked} onClick={onClose} aria-label="Cerrar encuadre">×</button>
        </header>
        <div className="framing-body">
          <div className="framing-preview-space">
            <div className="framing-preview">
              <ProxyCard deckCard={deckCard} symbols={symbols} layout={layout} framingOverride={framing} />
            </div>
          </div>
          <div className="framing-controls">
            <span className="framing-source">{sourceNames[source] || sourceNames.default}</span>
            <label>
              Posición vertical <output>{framing.offset}%</output>
              <input
                type="range"
                min={-20}
                max={35}
                step={0.5}
                value={framing.offset}
                disabled={blocked}
                aria-label="Posición vertical"
                onChange={(event) => setFraming((current) => ({ ...current, offset: Number(event.target.value) }))}
              />
            </label>
            <p>↓ bajar la imagen para mostrar la cabeza</p>
            <label>
              Zoom <output>{framing.zoom}%</output>
              <input
                type="range"
                min={70}
                max={160}
                step={1}
                value={framing.zoom}
                disabled={blocked}
                aria-label="Zoom"
                onChange={(event) => setFraming((current) => ({ ...current, zoom: Number(event.target.value) }))}
              />
            </label>
            <div className="framing-actions">
              <button type="button" className="secondary-button" disabled={blocked} onClick={() => setFraming(savedFraming(deckCard))}>Restablecer</button>
              <button type="button" className="secondary-button" disabled={blocked} onClick={() => run("auto")}>Auto</button>
              <button type="button" className="primary-button" disabled={blocked} onClick={() => run("save")}>Guardar</button>
            </div>
            {working && <p role="status">Ajustando encuadre…</p>}
            {error && <div className="error-panel" role="alert">{error}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
