import { useEffect, useState } from "react";
import "./CardTile.css";

export default function CardTile({
  deckCard,
  onRegenerate,
  onSaveAssignment,
  disabled = false,
  layout = "borderless",
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [element, setElement] = useState("");
  const [category, setCategory] = useState("");
  const [visualBrief, setVisualBrief] = useState("");
  const card = deckCard.card;
  const generatedImage = deckCard.generated_image;
  const generatedUrl = generatedImage?.image_url;
  const name = card?.name ?? deckCard.raw_name;

  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setModalOpen(false);
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  async function regenerate() {
    setRegenerating(true);
    setError("");
    try {
      await onRegenerate(deckCard.id);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "No se pudo generar la carta.");
    } finally {
      setRegenerating(false);
    }
  }

  function editAssignment() {
    setElement(deckCard.theme_assignment?.element || "");
    setCategory(deckCard.theme_assignment?.category || "");
    setVisualBrief(deckCard.theme_assignment?.visual_brief || "");
    setAssignmentError("");
    setEditing(true);
  }

  async function saveAssignment(event) {
    event.preventDefault();
    setSaving(true);
    setAssignmentError("");
    try {
      await onSaveAssignment(deckCard.id, {
        element,
        category,
        visual_brief: visualBrief,
      });
      setEditing(false);
    } catch (requestError) {
      const data = requestError.response?.data;
      const firstMessage = data && typeof data === "object"
        ? Object.values(data).flat()[0]
        : null;
      setAssignmentError(data?.detail || firstMessage || "No se pudo guardar la asignación.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`card-tile ${deckCard.resolution_error ? "card-tile-error" : ""}`}>
      <div className={`card-image-wrap ${layout === "borderless" ? "card-image-borderless" : ""}`}>
        {generatedUrl ? (
          <button
            type="button"
            className="card-image-button"
            onClick={() => setModalOpen(true)}
            aria-label={`Ampliar ${name}`}
            disabled={regenerating}
          >
            <img src={generatedUrl} alt={`Arte generado de ${name}`} />
          </button>
        ) : (
          <div className="image-placeholder"><span>✦</span>Sin generar</div>
        )}
        {deckCard.quantity > 1 && (
          <span className="quantity-badge">×{deckCard.quantity}</span>
        )}
        {card !== null && (
          <div className={`card-overlay ${!generatedUrl ? "card-overlay-visible" : ""}`}>
            {card.original_art_url && (
              <a href={card.original_art_url} target="_blank" rel="noreferrer">
                Ver original
              </a>
            )}
            <button
              type="button"
              onClick={regenerate}
              disabled={disabled || regenerating || saving || editing}
            >
              {regenerating ? "Generando…" : generatedUrl ? "Regenerar" : "Generar"}
            </button>
          </div>
        )}
        {regenerating && (
          <div className="regenerating"><span className="spinner" />Generando arte…</div>
        )}
      </div>
      <div className="card-info">
        <h3>{name}</h3>
        {generatedImage?.themed_name && (
          <p className="card-themed-name">{generatedImage.themed_name}</p>
        )}
        <p>{card?.type_line}</p>
        {card !== null && (
          <div className="card-assignment">
            {deckCard.theme_assignment && (
              <div className="assignment-label">
                <strong>{deckCard.theme_assignment.element}</strong>
                <span>{deckCard.theme_assignment.category}</span>
                {deckCard.theme_assignment.edited && <small>editado</small>}
              </div>
            )}
            {!editing ? (
              <button
                type="button"
                className="assignment-edit-button"
                onClick={editAssignment}
                disabled={disabled || regenerating || saving}
              >
                Editar tema
              </button>
            ) : (
              <form className="assignment-form" onSubmit={saveAssignment}>
                <label>
                  Elemento
                  <input
                    value={element}
                    onChange={(event) => setElement(event.target.value)}
                    required
                    disabled={disabled || saving}
                  />
                </label>
                <label>
                  Categoría
                  <input
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    disabled={disabled || saving}
                  />
                </label>
                <label>
                  Descripción visual
                  <textarea
                    value={visualBrief}
                    onChange={(event) => setVisualBrief(event.target.value)}
                    rows="4"
                    disabled={disabled || saving}
                  />
                </label>
                <div className="assignment-actions">
                  <button type="submit" className="secondary-button" disabled={disabled || saving}>
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setEditing(false)} disabled={saving}>
                    Cancelar
                  </button>
                </div>
                {assignmentError && <div className="card-resolution-error" role="alert">{assignmentError}</div>}
              </form>
            )}
          </div>
        )}
        {deckCard.resolution_error && (
          <div className="card-resolution-error">{deckCard.resolution_error}</div>
        )}
        {error && <div className="card-resolution-error">{error}</div>}
      </div>
      {modalOpen && (
        <div
          className="image-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Arte de ${name}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModalOpen(false);
            }
          }}
        >
          <button onClick={() => setModalOpen(false)} aria-label="Cerrar imagen">×</button>
          <div className="image-modal-content">
            <img src={generatedUrl} alt={`Arte generado de ${name} ampliado`} />
            {generatedImage?.themed_flavor && (
              <p className="image-modal-flavor"><em>{generatedImage.themed_flavor}</em></p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
