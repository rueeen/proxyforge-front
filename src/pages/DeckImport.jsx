import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./DeckImport.css";

export default function DeckImport() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [rawList, setRawList] = useState("");
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdDeck, setCreatedDeck] = useState(null);
  const [resolutionErrors, setResolutionErrors] = useState([]);
  const lineCount = useMemo(() => rawList.split("\n").filter((line) => line.trim()).length, [rawList]);

  async function submitDeck(event) {
    event.preventDefault();
    setLoading(true); setError(""); setCreatedDeck(null); setResolutionErrors([]);
    try {
      const response = await api.post("/decks/", { name, raw_list: rawList, theme });
      const deck = response.data;
      const cards = deck.cards || deck.deck_cards || [];
      const unresolved = cards.filter((card) => card.resolution_error);
      if (unresolved.length) { setCreatedDeck(deck); setResolutionErrors(unresolved); }
      else navigate(`/mazo/${deck.id}`);
    } catch (requestError) {
      const data = requestError.response?.data;
      setError(data?.detail || (data && typeof data === "object" ? Object.values(data).flat().join(" ") : "No se pudo importar el mazo."));
    } finally { setLoading(false); }
  }

  return (
    <section className="import-page">
      <div className="import-heading"><p className="eyebrow">Nuevo proyecto</p><h1>Importar mazo</h1><p>Pega tu lista. ProxyForge resolverá cada carta contra Scryfall.</p></div>
      <form className="import-form" onSubmit={submitDeck}>
        <label>Nombre del mazo<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Mi mazo de Commander" disabled={loading} /></label>
        <label>Lista de cartas<textarea rows="15" value={rawList} onChange={(event) => setRawList(event.target.value)} required placeholder={"4 Lightning Bolt\n1 Sol Ring (c21) 263\n2x Counterspell\nCommander\n1 Atraxa, Praetors' Voice"} disabled={loading} /></label>
        <div className="line-counter"><strong>{lineCount}</strong> {lineCount === 1 ? "línea no vacía" : "líneas no vacías"}</div>
        <label>Tema estético<input value={theme} onChange={(event) => setTheme(event.target.value)} required placeholder="ej: acuarela botánica, art nouveau, cyberpunk neón" disabled={loading} /><small>Describe un estilo visual, una atmósfera o una paleta; no una franquicia.</small></label>
        {error && <div className="error-panel">{error}<br /><button type="button" className="secondary-button" onClick={() => setError("")}>Reintentar</button></div>}
        {resolutionErrors.length > 0 && <div className="resolution-warning"><h2>Algunas cartas no se encontraron</h2><p>Las cartas resueltas ya quedaron guardadas. Puedes continuar o corregir la lista.</p><ul>{resolutionErrors.map((card, index) => <li key={card.id || `${card.name}-${index}`}><strong>{card.name || card.raw_name || "Carta desconocida"}</strong><span>{card.resolution_error}</span></li>)}</ul><div className="warning-actions"><button type="button" className="primary-button" onClick={() => navigate(`/mazo/${createdDeck.id}`)}>Continuar igual</button><button type="button" className="secondary-button" onClick={() => { setResolutionErrors([]); setCreatedDeck(null); }}>Volver a editar</button></div></div>}
        {!resolutionErrors.length && <button className="primary-button submit-button" type="submit" disabled={loading}>{loading ? "Resolviendo cartas…" : "Importar y resolver"}</button>}
      </form>
    </section>
  );
}
