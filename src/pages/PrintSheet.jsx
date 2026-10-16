import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import ProxyCard from "../components/ProxyCard";
import "./PrintSheet.css";

const sectionOrder = { commander: 0, main: 1, sideboard: 2 };

export default function PrintSheet() {
  const { id } = useParams();
  const [deck, setDeck] = useState(null);
  const [symbols, setSymbols] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [paper, setPaper] = useState("a4");
  const [nameMode, setNameMode] = useState("original");
  const [includeBasics, setIncludeBasics] = useState(false);
  const [useOriginalArt, setUseOriginalArt] = useState(true);
  const [generatedOnly, setGeneratedOnly] = useState(false);
  const [cutMarks, setCutMarks] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPage() {
      setLoading(true);
      setError("");
      setSymbols({});
      try {
        const [response] = await Promise.all([
          api.get(`/decks/${id}/`, { signal: controller.signal }),
          api.get("/symbology/", { signal: controller.signal }).then((symbolResponse) => {
            if (!controller.signal.aborted) {
              setSymbols(Object.fromEntries(symbolResponse.data.map((item) => [item.symbol, item.svg_uri])));
            }
          }).catch(() => {
            // La carta conserva los tokens de maná si no hay simbología disponible.
          }),
        ]);
        if (!controller.signal.aborted) {
          setDeck(response.data);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.response?.data?.detail || "No se pudo cargar el mazo para imprimir.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    loadPage();
    return () => {
      controller.abort();
    };
  }, [id, reloadKey]);

  const pages = useMemo(() => {
    if (!deck) {
      return [];
    }
    const entries = [...deck.cards].sort((a, b) => {
      return sectionOrder[a.section] - sectionOrder[b.section];
    });
    const cards = [];
    for (const entry of entries) {
      if (entry.card === null) {
        continue;
      }
      const basic = /^(Basic Land|Tierra básica)/i.test(entry.card.type_line);
      if ((!includeBasics && basic) || (generatedOnly && !entry.generated_image)) {
        continue;
      }
      for (let copy = 0; copy < entry.quantity; copy += 1) {
        cards.push({ entry, key: `${entry.id}-${copy}` });
      }
    }
    const result = [];
    for (let offset = 0; offset < cards.length; offset += 9) {
      result.push(cards.slice(offset, offset + 9));
    }
    return result;
  }, [deck, includeBasics, generatedOnly]);

  if (loading) {
    return <div className="page-loading">Preparando hojas…</div>;
  }
  if (error) {
    return (
      <div className="error-panel">
        {error}
        <br />
        <button className="secondary-button" onClick={() => setReloadKey((key) => key + 1)}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={`print-sheet paper-${paper} ${cutMarks ? "with-cut-marks" : ""}`}>
      <div className="print-controls">
        <Link to={`/mazo/${id}`}>← Volver al mazo</Link>
        <h1>Imprimir {deck.name}</h1>
        <div className="print-options">
          <label>
            Tamaño de papel
            <select
              aria-label="Tamaño de papel"
              value={paper}
              onChange={(event) => setPaper(event.target.value)}
            >
              <option value="a4">A4</option>
              <option value="letter">Carta</option>
            </select>
          </label>
          <label>
            Nombre
            <select
              aria-label="Nombre"
              value={nameMode}
              onChange={(event) => setNameMode(event.target.value)}
            >
              <option value="original">Original</option>
              <option value="themed">Temático</option>
            </select>
          </label>
          <label className="print-checkbox">
            <input
              type="checkbox"
              checked={includeBasics}
              onChange={(event) => setIncludeBasics(event.target.checked)}
            />
            Incluir tierras básicas
          </label>
          <label className="print-checkbox">
            <input
              type="checkbox"
              checked={useOriginalArt}
              onChange={(event) => setUseOriginalArt(event.target.checked)}
            />
            Usar arte original en cartas sin generar
          </label>
          <label className="print-checkbox">
            <input
              type="checkbox"
              checked={generatedOnly}
              onChange={(event) => setGeneratedOnly(event.target.checked)}
            />
            Solo cartas con arte generado
          </label>
          <label className="print-checkbox">
            <input
              type="checkbox"
              checked={cutMarks}
              onChange={(event) => setCutMarks(event.target.checked)}
            />
            Marcas de corte
          </label>
        </div>
        <button className="primary-button" onClick={() => window.print()} disabled={pages.length === 0}>
          Imprimir / Guardar PDF
        </button>
        <p>En el diálogo de impresión, usa escala 100% (o "Tamaño real") y márgenes mínimos.</p>
      </div>
      {pages.length === 0 && (
        <p className="print-empty">No hay cartas para imprimir con estos filtros.</p>
      )}
      <div className="print-pages">
        {pages.map((cards, index) => (
          <section className="print-page" key={index} aria-label={`Página ${index + 1} de ${pages.length}`}>
            <p className="print-page-counter">Página {index + 1} de {pages.length} · {cards.length} cartas</p>
            <div className="print-grid">
              {cards.map(({ entry, key }) => (
                <div className="print-card-slot" key={key}>
                  <ProxyCard
                    deckCard={entry}
                    symbols={symbols}
                    useOriginalArt={useOriginalArt}
                    nameMode={nameMode}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
