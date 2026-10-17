import { useEffect, useRef, useState } from "react";
import "./CardTile.css";

export default function CardTile({
  deckCard,
  onRegenerate,
  onSaveAssignment,
  onAddReference,
  onRemoveReference,
  onRetryAutoReference,
  disabled = false,
  layout = "borderless",
}) {
  const [modalOpen, setModalOpen] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [element, setElement] = useState("");
  const [category, setCategory] = useState("");
  const [visualBrief, setVisualBrief] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [needsReference, setNeedsReference] = useState(false);
  const [referenceWiki, setReferenceWiki] = useState("");
  const [referencePage, setReferencePage] = useState("");
  const [searchingReference, setSearchingReference] = useState(false);
  const [addingReference, setAddingReference] = useState(false);
  const [removingReference, setRemovingReference] = useState(false);
  const [referenceError, setReferenceError] = useState("");
  const fileInputRef = useRef(null);
  const referenceRequest = useRef(false);
  const references = deckCard.theme_assignment?.references || [];
  const referenceBusy = addingReference || removingReference || searchingReference;
  const controlsDisabled = disabled || regenerating || saving || referenceBusy;
  const maximumReferences = references.length >= 3;
  const card = deckCard.card;
  const generatedImage = deckCard.generated_image;
  const generatedUrl = generatedImage?.image_url;
  const name = card?.name ?? deckCard.raw_name;
  const assignment = deckCard.theme_assignment;
  const referenceStatus = references.length > 0 ? "found" : assignment?.auto_reference_status || "";
  const referenceStatuses = {
    "": { label: "Referencia pendiente", tone: "pending" },
    found: { label: "Con referencia", tone: "found" },
    not_found: { label: "Sin imagen en la wiki", tone: "warning" },
    rejected: { label: "Imagen descartada", tone: "warning" },
    error: { label: "Error al buscar", tone: "error" },
  };
  const status = referenceStatuses[referenceStatus] || referenceStatuses[""];
  const retryable = ["not_found", "rejected", "error"].includes(referenceStatus);
  const referenceStatusDisplay = assignment?.needs_reference && (
    <div className="auto-reference-status" aria-live="polite">
      <span className={`reference-status reference-status-${status.tone}`} title={assignment.auto_reference_message || undefined}>
        {status.label}
      </span>
      {referenceStatus === "rejected" && assignment.auto_reference_message && (
        <small>{assignment.auto_reference_message}</small>
      )}
    </div>
  );

  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setModalOpen(null);
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
    setReferenceError("");
    setNeedsReference(Boolean(assignment?.needs_reference));
    setReferenceWiki(assignment?.reference_wiki || "");
    setReferencePage(assignment?.reference_page || "");
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
        needs_reference: needsReference,
        reference_wiki: referenceWiki.trim(),
        reference_page: referencePage.trim(),
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

  async function addReference({ file, url }) {
    if (referenceRequest.current || controlsDisabled || maximumReferences) {
      return;
    }
    setReferenceError("");
    if (file && file.size > 10 * 1024 * 1024) {
      setReferenceError("La imagen debe pesar 10 MB o menos.");
      return;
    }
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setReferenceError("Selecciona una imagen JPEG, PNG o WebP.");
      return;
    }
    if (!file && !url?.trim()) {
      setReferenceError("Ingresa una URL de imagen.");
      return;
    }
    referenceRequest.current = true;
    setAddingReference(true);
    try {
      await onAddReference(deckCard.id, file ? { file } : { url: url.trim() });
      setReferenceUrl("");
    } catch (requestError) {
      setReferenceError(requestError.response?.data?.detail || "No se pudo agregar la referencia.");
    } finally {
      referenceRequest.current = false;
      setAddingReference(false);
    }
  }

  async function removeReference(referenceId) {
    if (referenceRequest.current || controlsDisabled || !window.confirm(
      "¿Quitar esta referencia? La carta quedará pendiente de regenerar."
    )) {
      return;
    }
    referenceRequest.current = true;
    setRemovingReference(true);
    setReferenceError("");
    try {
      await onRemoveReference(deckCard.id, referenceId);
    } catch (requestError) {
      setReferenceError(requestError.response?.data?.detail || "No se pudo quitar la referencia.");
    } finally {
      referenceRequest.current = false;
      setRemovingReference(false);
    }
  }

  async function retryAutoReference(saveChanges = false) {
    if (referenceRequest.current || controlsDisabled) {
      return;
    }
    referenceRequest.current = true;
    setSearchingReference(true);
    setReferenceError("");
    try {
      const changed = needsReference !== Boolean(assignment?.needs_reference) ||
        referenceWiki.trim() !== (assignment?.reference_wiki || "") ||
        referencePage.trim() !== (assignment?.reference_page || "");
      if (saveChanges && changed) {
        await onSaveAssignment(deckCard.id, {
          element,
          category,
          visual_brief: visualBrief,
          needs_reference: needsReference,
          reference_wiki: referenceWiki.trim(),
          reference_page: referencePage.trim(),
        });
      }
      await onRetryAutoReference(deckCard.id);
    } catch (requestError) {
      setReferenceError(requestError.response?.data?.detail || "No se pudo buscar la referencia en la wiki.");
    } finally {
      referenceRequest.current = false;
      setSearchingReference(false);
    }
  }

  return (
    <article className={`card-tile ${deckCard.resolution_error ? "card-tile-error" : ""}`}>
      <div className={`card-image-wrap ${layout === "borderless" ? "card-image-borderless" : ""}`}>
        {generatedUrl ? (
          <button
            type="button"
            className="card-image-button"
            onClick={() => setModalOpen({
              url: generatedUrl,
              alt: `Arte generado de ${name} ampliado`,
              flavor: generatedImage?.themed_flavor,
            })}
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
              disabled={controlsDisabled || editing}
            >
              {regenerating ? "Generando…" : generatedUrl ? "Regenerar" : "Generar"}
            </button>
            {references.length > 0 && !generatedImage && (
              <span className="reference-generation-hint">Usará {references.length} referencia(s)</span>
            )}
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
            {referenceStatusDisplay}
            {assignment?.needs_reference && retryable && (
              <button
                type="button"
                className="reference-retry"
                disabled={controlsDisabled}
                onClick={() => retryAutoReference()}
              >
                Reintentar
              </button>
            )}
            {references.length > 0 && (
              <div className="reference-thumbnails" aria-label="Imágenes de referencia">
                {references.map((reference, index) => (
                  <div className="reference-thumbnail" key={reference.id}>
                    <button
                      type="button"
                      className="reference-preview"
                      aria-label={`Ampliar referencia ${index + 1} de ${name}`}
                      onClick={() => setModalOpen({
                        url: reference.image_url,
                        alt: `Referencia ${index + 1} de ${name}`,
                        sourceUrl: reference.origin === "auto" ? reference.source_url : null,
                      })}
                    >
                      <img src={reference.image_url} alt={`Referencia ${index + 1} de ${name}`} />
                    </button>
                    {reference.origin === "auto" && <span className="reference-auto-badge">auto</span>}
                    <button
                      type="button"
                      className="reference-remove"
                      aria-label={`Quitar referencia ${index + 1} de ${name}`}
                      disabled={controlsDisabled}
                      onClick={() => removeReference(reference.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!editing ? (
              <button
                type="button"
                className="assignment-edit-button"
                onClick={editAssignment}
                disabled={controlsDisabled}
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
                    disabled={controlsDisabled}
                  />
                </label>
                <label>
                  Categoría
                  <input
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    disabled={controlsDisabled}
                  />
                </label>
                <label>
                  Descripción visual
                  <textarea
                    value={visualBrief}
                    onChange={(event) => setVisualBrief(event.target.value)}
                    rows="4"
                    disabled={controlsDisabled}
                  />
                </label>
                <section className="reference-section" aria-label="Imágenes de referencia (máx. 3)">
                  <h4>Imágenes de referencia (máx. 3)</h4>
                  <label className="reference-checkbox">
                    <input
                      type="checkbox"
                      checked={needsReference}
                      onChange={(event) => setNeedsReference(event.target.checked)}
                      disabled={controlsDisabled}
                    />
                    Este elemento necesita referencia
                  </label>
                  <label>
                    Wiki (dominio)
                    <input
                      value={referenceWiki}
                      onChange={(event) => setReferenceWiki(event.target.value)}
                      placeholder="warcraft.wiki.gg"
                      disabled={controlsDisabled || !needsReference}
                    />
                  </label>
                  <label>
                    Página
                    <input
                      value={referencePage}
                      onChange={(event) => setReferencePage(event.target.value)}
                      placeholder="Vol'jin"
                      disabled={controlsDisabled || !needsReference}
                    />
                  </label>
                  <p>Dominio de la wiki de la franquicia (Fandom, wiki.gg…) y el título exacto de la página del personaje.</p>
                  {assignment && (
                    <button
                      type="button"
                      className="secondary-button reference-wiki-search"
                      disabled={controlsDisabled || !needsReference || !referenceWiki.trim() || !referencePage.trim() || !element.trim()}
                      onClick={() => retryAutoReference(true)}
                    >
                      Buscar en la wiki
                    </button>
                  )}
                  {referenceStatusDisplay}
                  {editing && assignment?.auto_reference_message && referenceStatus !== "rejected" && (
                    <p className="reference-search-message">{assignment.auto_reference_message}</p>
                  )}
                  {!deckCard.theme_assignment ? (
                    <p>Guarda primero el elemento temático para poder agregar referencias.</p>
                  ) : (
                    <>
                      <p>Agrega imágenes del personaje para que la ilustración se le parezca. Se usan como referencia de identidad, no se copian.</p>
                      <label>
                        URL de imagen
                        <input
                          type="text"
                          inputMode="url"
                          value={referenceUrl}
                          onChange={(event) => setReferenceUrl(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addReference({ url: referenceUrl });
                            }
                          }}
                          placeholder="https://…"
                          disabled={controlsDisabled || maximumReferences}
                        />
                      </label>
                      <div className="reference-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={controlsDisabled || maximumReferences || !referenceUrl.trim()}
                          onClick={() => addReference({ url: referenceUrl })}
                        >
                          Agregar URL
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={controlsDisabled || maximumReferences}
                          onClick={() => fileInputRef.current.click()}
                        >
                          Subir imagen
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          hidden
                          disabled={controlsDisabled || maximumReferences}
                          onChange={(event) => {
                            const file = event.target.files[0];
                            event.target.value = "";
                            if (file) {
                              addReference({ file });
                            }
                          }}
                        />
                      </div>
                      {maximumReferences && <p>Máximo alcanzado</p>}
                      {addingReference && <p role="status">Agregando…</p>}
                    </>
                  )}
                </section>
                <div className="assignment-actions">
                  <button type="submit" className="secondary-button" disabled={controlsDisabled}>
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setEditing(false)} disabled={saving || referenceBusy}>
                    Cancelar
                  </button>
                </div>
                {assignmentError && <div className="card-resolution-error" role="alert">{assignmentError}</div>}
              </form>
            )}
            {searchingReference && <p role="status">Buscando imágenes en la wiki…</p>}
            {removingReference && <p role="status">Quitando referencia…</p>}
            {referenceError && <div className="card-resolution-error" role="alert">{referenceError}</div>}
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
          aria-label={modalOpen.alt}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModalOpen(null);
            }
          }}
        >
          <button onClick={() => setModalOpen(null)} aria-label="Cerrar imagen">×</button>
          <div className="image-modal-content">
            <img src={modalOpen.url} alt={modalOpen.alt} />
            {modalOpen.sourceUrl && (
              <p className="reference-source">
                <a href={modalOpen.sourceUrl} target="_blank" rel="noreferrer">Ver origen</a>
              </p>
            )}
            {modalOpen.flavor && (
              <p className="image-modal-flavor"><em>{modalOpen.flavor}</em></p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
