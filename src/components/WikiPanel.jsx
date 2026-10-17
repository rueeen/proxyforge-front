import { useEffect, useId, useRef, useState } from "react";
import "./WikiPanel.css";

function suggestedDomain(deck) {
  const recommended = deck.wiki_candidates?.find((candidate) => candidate.ok && candidate.recommended);
  const saved = deck.wiki_candidates?.find((candidate) => candidate.domain === deck.reference_wiki);
  return recommended?.domain || (saved && !saved.ok ? "" : deck.reference_wiki) || "";
}

function domainHost(value) {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export default function WikiPanel({ deck, busy, onFindCandidates, onConfirm, onUnconfirm, onChangeCount }) {
  const [selected, setSelected] = useState(() => suggestedDomain(deck));
  const [otherWiki, setOtherWiki] = useState("");
  const [alternative, setAlternative] = useState(deck.reference_wiki_alt || "");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const request = useRef(false);
  const radioName = useId();
  const candidates = deck.wiki_candidates || [];
  const candidateKey = JSON.stringify(candidates.map(({ domain, ok, recommended }) => [domain, ok, recommended]));
  const primary = otherWiki.trim() || selected;
  const alternatives = candidates.filter((candidate) => candidate.ok && domainHost(candidate.domain) !== domainHost(primary));
  const validAlternative = alternatives.some((candidate) => candidate.domain === alternative) ? alternative : "";
  const confirmed = candidates.find((candidate) => candidate.domain === deck.reference_wiki);
  const fandom = confirmed?.fandom || /(^|\.)fandom\.com$/i.test(domainHost(deck.reference_wiki || ""));
  const blocked = busy || Boolean(pending);

  useEffect(() => {
    setSelected(suggestedDomain(deck));
    setOtherWiki("");
    setAlternative(deck.reference_wiki_alt || "");
  }, [deck.id, candidateKey, deck.reference_wiki_confirmed, deck.reference_wiki, deck.reference_wiki_alt]);

  async function run(action, callback) {
    if (blocked || request.current) {
      return;
    }
    request.current = true;
    setPending(action);
    setError("");
    try {
      await callback();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || requestError.message || "No se pudo actualizar la wiki de referencia.");
    } finally {
      request.current = false;
      setPending("");
    }
  }

  return (
    <section className="wiki-panel" aria-label="Wiki de referencia">
      <h3>Wiki de referencia</h3>
      {deck.reference_wiki_confirmed ? (
        <div className="wiki-panel-confirmed">
          <p>Wiki: <strong>{confirmed?.sitename || deck.reference_wiki}</strong> ({deck.reference_wiki})</p>
          {deck.reference_wiki_alt && <p>Alternativa: {deck.reference_wiki_alt}</p>}
          {fandom && <span className="wiki-panel-fandom">Fandom: imágenes manuales (Ctrl+V)</span>}
          <div className="wiki-panel-actions">
            <a href={`https://${domainHost(deck.reference_wiki)}`} target="_blank" rel="noreferrer">Abrir ↗</a>
            <button type="button" className="theme-plan-link" disabled={blocked} onClick={() => run("unconfirm", onUnconfirm)}>Cambiar</button>
          </div>
        </div>
      ) : (
        <>
          <p>Para buscar imágenes de referencia, confirma la wiki de la franquicia.</p>
          <button type="button" className="secondary-button" disabled={blocked} onClick={() => run("find", onFindCandidates)}>Buscar wikis</button>
          {pending === "find" && <div className="planning-status" role="status"><span className="spinner" />Buscando y verificando wikis…</div>}
          <fieldset className="wiki-candidates" disabled={blocked}>
            <legend>Wikis candidatas</legend>
            {candidates.map((candidate) => (
              <label className={`wiki-candidate ${!candidate.ok ? "wiki-candidate-unavailable" : ""}`} key={candidate.domain}>
                <input
                  type="radio"
                  name={radioName}
                  value={candidate.domain}
                  checked={!otherWiki.trim() && selected === candidate.domain}
                  disabled={!candidate.ok}
                  onChange={() => {
                    setSelected(candidate.domain);
                    setOtherWiki("");
                  }}
                />
                <span>
                  <strong>{candidate.sitename || candidate.domain}</strong>
                  <span className="wiki-candidate-domain">{candidate.domain}</span>
                  <small className="wiki-candidate-why">{candidate.why}</small>
                  <small className={candidate.ok ? "wiki-candidate-ok" : "wiki-candidate-error"}>
                    {candidate.ok ? `✓ Responde · ${candidate.found}/${candidate.checked} personajes encontrados` : `✗ No responde: ${candidate.error || "Error al verificar"}`}
                  </small>
                  <span className="wiki-candidate-badges">
                    {candidate.fandom && <span className="wiki-panel-fandom">Fandom: imágenes manuales (Ctrl+V)</span>}
                    {candidate.recommended && <span className="wiki-panel-recommended">Recomendada</span>}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="wiki-panel-fields">
            <label>Otra wiki (dominio o URL)
              <input value={otherWiki} onChange={(event) => setOtherWiki(event.target.value)} disabled={blocked} />
            </label>
            <label>Wiki alternativa (opcional)
              <select aria-label="Wiki alternativa (opcional)" value={validAlternative} onChange={(event) => setAlternative(event.target.value)} disabled={blocked}>
                <option value="">Ninguna</option>
                {alternatives.map((candidate) => <option value={candidate.domain} key={candidate.domain}>{candidate.sitename || candidate.domain} ({candidate.domain})</option>)}
              </select>
            </label>
          </div>
          <button type="button" className="primary-button" disabled={blocked || !primary} onClick={() => run("confirm", () => onConfirm(primary, validAlternative))}>Confirmar wiki</button>
          {deck.has_theme_plan && <p className="wiki-panel-warning">Las wikis del plan no están verificadas; confirma una para mejores referencias.</p>}
        </>
      )}
      <div className="wiki-reference-count">
        <label>Referencias por carta
          <select aria-label="Referencias por carta" value={deck.auto_reference_count ?? 1} disabled={blocked} onChange={(event) => run("count", () => onChangeCount(Number(event.target.value)))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        <small>Más referencias = más parecido. Cada referencia suma ~USD 0,01 por imagen generada.</small>
      </div>
      {pending && pending !== "find" && <p role="status">Guardando configuración de referencias…</p>}
      {error && <div className="error-panel" role="alert">{error}</div>}
    </section>
  );
}
