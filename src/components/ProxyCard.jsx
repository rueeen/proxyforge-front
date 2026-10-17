import { useLayoutEffect, useRef, useState } from "react";
import "./ProxyCard.css";
import { readableText, rgba, rarityGem } from "../colorUtils";

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

function Rules({ oracleText, flavor, symbols, textRef }) {
  return (
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
  );
}

function Stats({ face }) {
  if (face?.loyalty != null && face.loyalty !== "") {
    return <span className="proxy-stats proxy-loyalty">{face.loyalty}</span>;
  }
  if (face?.power != null && face.power !== "") {
    return <span className="proxy-stats">{face.power}/{face.toughness}</span>;
  }
  return null;
}

function CardTitle({ name, nameRef, face, symbols }) {
  return (
    <header className="proxy-title-bar">
      <h3 ref={nameRef}>{name}</h3>
      <span className="proxy-mana-cost">{renderSymbols(face?.mana_cost || "", symbols)}</span>
    </header>
  );
}

function ClassicLayout({ data, nameRef, textRef }) {
  const { card, face, name, alternateName, originalName, art, originalArt, hasStats, symbols } = data;
  return (
    <>
      <CardTitle name={name} nameRef={nameRef} face={face} symbols={symbols} />
      <div className="proxy-art">
        {art ? (
          <img className="proxy-art-image" src={art} alt={`Ilustración de ${originalName}`} />
        ) : <div className="proxy-art-placeholder">{data.placeholder}</div>}
        {alternateName && <span className="proxy-alternate-name">{alternateName}</span>}
        {originalArt && <span className="proxy-original-art">arte original</span>}
      </div>
      <div className="proxy-type-bar">{face?.type_line}</div>
      <div className={`proxy-text-box ${hasStats ? "proxy-text-with-stats" : ""}`}>
        <Rules {...data} textRef={textRef} />
        <Stats face={face} />
      </div>
      <footer className="proxy-footer">
        <span>{card?.set_code?.toUpperCase()} {card?.collector_number}</span>
        {card?.card_faces?.length > 0 && <span>⟲ 2 caras</span>}
        <span>PROXY · ProxyForge</span>
      </footer>
    </>
  );
}

function BorderlessLayout({ data, nameRef, textRef, typeRef, onArtLoad, landscape }) {
  const { card, face, name, alternateName, originalName, art, originalArt, hasStats, symbols } = data;
  return (
    <>
      {art ? (
        <img
          className="proxy-art-image"
          src={art}
          alt={`Ilustración de ${originalName}`}
          onLoad={onArtLoad}
        />
      ) : <div className="proxy-art-placeholder">{data.placeholder}</div>}
      <CardTitle name={name} nameRef={nameRef} face={face} symbols={symbols} />
      {alternateName && <span className="proxy-alternate-name">{alternateName}</span>}
      {(landscape || originalArt) && (
        <div className="proxy-art-labels">
          {originalArt && <span className="proxy-original-art">arte original</span>}
          {landscape && <span className="proxy-landscape-notice">arte horizontal · regenera para vertical</span>}
        </div>
      )}
      <div className="proxy-bottom-block">
        <div className="proxy-type-bar">
          <span ref={typeRef}>{face?.type_line}</span>
          <span className="proxy-rarity-gem" role="img" aria-label={`Rareza: ${card?.rarity || "common"}`} />
        </div>
        <div className={`proxy-text-box ${hasStats ? "proxy-text-with-stats" : ""}`}>
          <Rules {...data} textRef={textRef} />
        </div>
        <Stats face={face} />
      </div>
      <footer className="proxy-footer">
        <span>
          {card?.set_code?.toUpperCase()} · {card?.collector_number}
          {card?.card_faces?.length > 0 ? " ⟲" : ""} · {(card?.rarity || "common")[0].toUpperCase()}
        </span>
        <span>PROXY</span>
        <span>ProxyForge</span>
      </footer>
    </>
  );
}

export default function ProxyCard({
  deckCard,
  symbols = {},
  useOriginalArt = false,
  nameMode = "themed",
  layout = "borderless",
}) {
  const textRef = useRef(null);
  const nameRef = useRef(null);
  const typeRef = useRef(null);
  const [landscapeArt, setLandscapeArt] = useState(null);
  const card = deckCard.card;
  const generated = deckCard.generated_image;
  const face = card?.card_faces?.[0] ?? card;
  const originalName = face?.name ?? deckCard.raw_name;
  const themedName = generated?.themed_name;
  const name = nameMode === "themed" && themedName ? themedName : originalName;
  const alternateName = themedName ? nameMode === "themed" ? originalName : themedName : "";
  const oracleText = face?.oracle_text || "";
  const flavor = generated?.themed_flavor || face?.flavor_text || card?.flavor_text || "";
  const art = generated?.image_url || (useOriginalArt ? card?.original_art_url : "");
  const originalArt = !generated?.image_url && Boolean(art);
  const colors = face?.colors || card?.colors || [];
  const color = colors.length > 1 ? "multicolor" : colors[0] || "colorless";
  const frame = { ...defaultFrames[color], ...generated?.frame_style };
  const hasStats = (face?.power != null && face.power !== "") || (face?.loyalty != null && face.loyalty !== "");
  const borderless = layout !== "classic";
  const landscape = Boolean(art) && landscapeArt === art;
  const gem = rarityGem(card?.rarity);
  const data = {
    card,
    face,
    name,
    alternateName,
    originalName,
    oracleText,
    flavor,
    art,
    originalArt,
    hasStats,
    symbols,
    placeholder: deckCard.theme_assignment?.element || "Sin ilustración",
  };

  useLayoutEffect(() => {
    let active = true;
    function fit() {
      if (active) {
        fitText(textRef.current, 8.5, 5.5);
        fitText(nameRef.current, borderless ? 8.5 : 9, borderless ? 5.5 : 6, true);
        fitText(typeRef.current, 6.5, 5, true);
      }
    }
    fit();
    document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    // Mana SVGs can finish loading after the first fit, changing line widths.
    const images = [...textRef.current.querySelectorAll("img"), ...nameRef.current.parentElement.querySelectorAll("img")];
    images.forEach((image) => image.addEventListener("load", fit));
    const observer = new ResizeObserver(fit);
    observer.observe(textRef.current);
    window.addEventListener("beforeprint", fit);
    window.addEventListener("afterprint", fit);
    return () => {
      active = false;
      document.fonts.removeEventListener("loadingdone", fit);
      images.forEach((image) => image.removeEventListener("load", fit));
      observer.disconnect();
      window.removeEventListener("beforeprint", fit);
      window.removeEventListener("afterprint", fit);
    };
  }, [oracleText, flavor, name, symbols, hasStats, face?.mana_cost, face?.type_line, borderless]);

  return (
    <article
      className={`proxy-card ${borderless ? "borderless" : "classic"} ${landscape && borderless ? "art-landscape" : ""} ${["rare", "mythic"].includes(card?.rarity) ? "proxy-foil" : ""}`}
      title={frame.texture}
      aria-label={`Carta proxy: ${originalName}`}
      style={{
        "--frame-border": frame.border,
        "--frame-background": frame.background,
        "--frame-text-box": frame.text_box,
        "--frame-accent": frame.accent,
        "--title-text": readableText(borderless ? frame.background : frame.accent),
        "--title-shadow": readableText(borderless ? frame.background : frame.accent) === "#141414" ? "#fff6" : "#0009",
        "--type-text": readableText(borderless ? frame.background : frame.accent),
        "--rules-text": readableText(frame.text_box),
        "--stats-text": readableText(frame.accent),
        "--footer-text": readableText(frame.background),
        "--plate-top": rgba(frame.background, .9),
        "--plate-bottom": rgba(frame.background, .74),
        "--plate-print": rgba(frame.background, .92),
        "--rules-background": rgba(frame.text_box, .84),
        "--rules-print": rgba(frame.text_box, .92),
        "--rules-border": rgba(frame.accent, .65),
        "--gem-from": gem.from,
        "--gem-to": gem.to,
      }}
    >
      {borderless ? (
        <BorderlessLayout
          data={data}
          nameRef={nameRef}
          textRef={textRef}
          typeRef={typeRef}
          landscape={landscape}
          onArtLoad={(event) => {
            const image = event.currentTarget;
            setLandscapeArt(image.naturalWidth > image.naturalHeight ? art : null);
          }}
        />
      ) : <ClassicLayout data={data} nameRef={nameRef} textRef={textRef} />}
    </article>
  );
}
