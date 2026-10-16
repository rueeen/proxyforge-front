import { useLayoutEffect, useRef } from "react";
import "./ProxyCard.css";

const defaultFrames = {
  W: { border: "#9b8a61", background: "#e9dfc5", text_box: "#fff9e8", accent: "#d9cda5" },
  U: { border: "#244f70", background: "#a8c7dd", text_box: "#edf6fc", accent: "#7eaccd" },
  B: { border: "#24222c", background: "#77717e", text_box: "#e7e3e9", accent: "#b5abbc" },
  R: { border: "#783a2c", background: "#ce8a72", text_box: "#fff0e6", accent: "#e6a183" },
  G: { border: "#31553c", background: "#9bb397", text_box: "#eef4e5", accent: "#b2c99d" },
  colorless: { border: "#555b62", background: "#b7bec3", text_box: "#f0f1f2", accent: "#d0d4d7" },
  multicolor: { border: "#7c6227", background: "#c9b36c", text_box: "#faf3d9", accent: "#e6d38b" },
};

export function renderSymbols(text, symbols = {}) {
  return text.split(/(\{[^}]+\})/).map((token, index) => {
    if (symbols[token]) {
      return <img className="mana-symbol" src={symbols[token]} alt={token} key={index} />;
    }
    return token;
  });
}

function fitText(element, startSize, minimumSize, singleLine = false) {
  if (!element) {
    return;
  }
  let size = startSize;
  element.style.fontSize = `${size}pt`;
  while (
    size > minimumSize &&
    (singleLine ? element.scrollWidth > element.clientWidth : element.scrollHeight > element.clientHeight)
  ) {
    size -= 0.25;
    element.style.fontSize = `${size}pt`;
  }
}

export default function ProxyCard({
  deckCard,
  symbols = {},
  useOriginalArt = false,
  nameMode = "original",
}) {
  const textRef = useRef(null);
  const nameRef = useRef(null);
  const card = deckCard.card;
  const generated = deckCard.generated_image;
  const face = card?.card_faces?.[0] ?? card;
  const originalName = face?.name ?? deckCard.raw_name;
  const themedName = generated?.themed_name;
  const name = nameMode === "themed" && themedName ? themedName : originalName;
  const alternateName = nameMode === "themed" && themedName ? originalName : themedName;
  const oracleText = face?.oracle_text || "";
  const flavor = generated?.themed_flavor || card?.flavor_text || "";
  const art = generated?.image_url || (useOriginalArt ? card?.original_art_url : "");
  const originalArt = !generated?.image_url && Boolean(art);
  const colors = card?.colors || [];
  const color = colors.length > 1 ? "multicolor" : colors[0] || "colorless";
  const frame = generated?.frame_style ?? defaultFrames[color];
  const hasStats = Boolean(face?.power || face?.loyalty);

  useLayoutEffect(() => {
    let active = true;
    function fit() {
      if (active) {
        fitText(textRef.current, 8.5, 5.5);
        fitText(nameRef.current, 9, 6, true);
      }
    }
    fit();
    document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      active = false;
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [oracleText, flavor, name, symbols, hasStats, face?.mana_cost]);

  return (
    <article
      className="proxy-card"
      title={frame.texture}
      aria-label={`Carta proxy: ${originalName}`}
      style={{
        "--frame-border": frame.border,
        "--frame-background": frame.background,
        "--frame-text-box": frame.text_box,
        "--frame-accent": frame.accent,
      }}
    >
      <header className="proxy-title-bar">
        <h3 ref={nameRef}>{name}</h3>
        <span className="proxy-mana-cost">{renderSymbols(face?.mana_cost || "", symbols)}</span>
      </header>
      <div className="proxy-art">
        {art ? (
          <img className="proxy-art-image" src={art} alt={`Ilustración de ${originalName}`} />
        ) : (
          <div className="proxy-art-placeholder">
            {deckCard.theme_assignment?.element || "Sin ilustración"}
          </div>
        )}
        {alternateName && <span className="proxy-alternate-name">{alternateName}</span>}
        {originalArt && <span className="proxy-original-art">arte original</span>}
      </div>
      <div className="proxy-type-bar">{face?.type_line}</div>
      <div className={`proxy-text-box ${hasStats ? "proxy-text-with-stats" : ""}`}>
        <div className="proxy-rules" ref={textRef}>
          {oracleText.split("\n").map((paragraph, index) => (
            <p key={index}>
              {paragraph.split(/(\([^)]*\))/).map((part, partIndex) => (
                part.startsWith("(") ? (
                  <em key={partIndex}>{renderSymbols(part, symbols)}</em>
                ) : (
                  <span key={partIndex}>{renderSymbols(part, symbols)}</span>
                )
              ))}
            </p>
          ))}
          {flavor && <p className="proxy-flavor"><em>{flavor}</em></p>}
        </div>
        {face?.loyalty ? (
          <span className="proxy-stats proxy-loyalty">{face.loyalty}</span>
        ) : face?.power ? (
          <span className="proxy-stats">{face.power}/{face.toughness}</span>
        ) : null}
      </div>
      <footer className="proxy-footer">
        <span>{card?.set_code?.toUpperCase()} {card?.collector_number}</span>
        {card?.card_faces?.length > 0 && <span>⟲ 2 caras</span>}
        <span>PROXY · ProxyForge</span>
      </footer>
    </article>
  );
}
