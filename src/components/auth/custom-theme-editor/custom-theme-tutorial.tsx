"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "dolziklub:custom-theme-tutorial:v1";
const STORAGE_EVENT = "dolziklub-custom-theme-tutorial";

const steps = [
  {
    eyebrow: "01 · LA RÈGLE",
    title: "Tu changes le look, jamais le profil.",
    body: "Le site conserve l’ordre, les grilles, les boutons, les liens et toutes les sections. Aucun réglage de ce guide ne peut déplacer ou masquer un contenu.",
    tip: "Commence par une inspiration si tu veux une base rapide, puis personnalise ses tokens.",
  },
  {
    eyebrow: "02 · FOND ET COULEURS",
    title: "Construis d’abord l’ambiance générale.",
    body: "Choisis une couleur unie, un dégradé, un motif ou une image. Les couleurs détaillées contrôlent ensuite les surfaces, textes, liens, boutons, badges et séparateurs.",
    tip: "La palette ne met à jour l’aperçu qu’une fois ton choix terminé : elle reste donc ouverte pendant que tu explores le dégradé.",
  },
  {
    eyebrow: "03 · IMAGES",
    title: "Fond et décoration sont deux usages différents.",
    body: "« Utiliser en fond » couvre la page derrière le profil. « Ajouter une déco » place plutôt un sticker ou un dessin dans un emplacement sûr prévu par le site.",
    tip: "Après l’import, choisis explicitement l’un des deux boutons. Une image reste privée tant que le thème n’est pas publié.",
  },
  {
    eyebrow: "04 · TYPOGRAPHIE",
    title: "Chaque rôle peut avoir sa propre voix.",
    body: "Les grands titres, le texte courant, les labels, les boutons et les statistiques ont des réglages séparés : famille, taille, graisse, casse, italique et espacement.",
    tip: "Garde le texte courant lisible et réserve les polices Affiche ou Machine à écrire aux titres et labels.",
  },
  {
    eyebrow: "05 · CARTES ET CADRES",
    title: "Arrondis les pochettes sans toucher aux grilles.",
    body: "Tu peux arrondir les coins des cartes et des jaquettes, choisir un trait simple, double ou aucun cadre, changer le fond et ajouter une inclinaison très légère.",
    tip: "Une valeur de 0 px garde des coins carrés ; 12 à 20 px donne un rendu nettement plus doux.",
  },
  {
    eyebrow: "06 · MOUVEMENTS",
    title: "Ajoute du rythme, pas du bruit.",
    body: "Les préréglages Subtil, Dynamique et Halo combinent entrée des sections, survols et liens. La durée reste bornée pour ne pas rendre le profil pénible.",
    tip: "Les animations sont automatiquement neutralisées pour les visiteurs ayant activé la réduction des mouvements.",
  },
  {
    eyebrow: "07 · APERÇU",
    title: "Contrôle le vrai profil à trois largeurs.",
    body: "Ordinateur, tablette et mobile affichent la vraie page avec tes vraies données. Le bouton Plein écran agrandit uniquement l’aperçu pour inspecter les détails.",
    tip: "Vérifie surtout le contraste, les textes longs et les trois colonnes avant de publier.",
  },
  {
    eyebrow: "08 · FILET DE SÉCURITÉ",
    title: "Tu peux expérimenter sans perdre ton chemin.",
    body: "Annuler et Rétablir conservent jusqu’à 50 états locaux. Tout réinitialiser revient à une base neutre proche du profil standard, sans ombres ou rotations imposées.",
    tip: "Les micro-changements restent locaux : aucune écriture Supabase n’est envoyée pendant que tu déplaces un curseur.",
  },
] as const;

function subscribeTutorial(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function tutorialDismissed() {
  return window.localStorage.getItem(STORAGE_KEY) === "done";
}

export function CustomThemeTutorial() {
  const dismissed = useSyncExternalStore(subscribeTutorial, tutorialDismissed, () => true);
  const [forcedOpen, setForcedOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = forcedOpen || !dismissed;
  const step = steps[stepIndex];

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open, stepIndex]);

  const close = () => {
    window.localStorage.setItem(STORAGE_KEY, "done");
    setForcedOpen(false);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  };

  const relaunch = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setStepIndex(0);
    setForcedOpen(true);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  };

  const move = (direction: -1 | 1) => {
    setStepIndex((current) => Math.min(steps.length - 1, Math.max(0, current + direction)));
  };

  return (
    <>
      <button type="button" onClick={relaunch}>Guide complet</button>
      {open ? (
        <div className="custom-theme-tutorial" role="presentation">
          <div
            ref={dialogRef}
            className="custom-theme-tutorial__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-theme-tutorial-title"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
              if (event.key === "ArrowLeft") move(-1);
              if (event.key === "ArrowRight" && stepIndex < steps.length - 1) move(1);
              if (event.key === "Tab") {
                const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
                if (!focusable?.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
              }
            }}
          >
            <div className="custom-theme-tutorial__progress" aria-label={`Étape ${stepIndex + 1} sur ${steps.length}`}>
              {steps.map((item, index) => <i key={item.eyebrow} data-active={index <= stepIndex} />)}
            </div>
            <p className="eyebrow">{step.eyebrow}</p>
            <h2 id="custom-theme-tutorial-title">{step.title}</h2>
            <p>{step.body}</p>
            <aside><b>CONSEIL</b><span>{step.tip}</span></aside>
            <div className="custom-theme-tutorial__actions">
              <button type="button" className="is-quiet" onClick={close}>Passer le guide</button>
              <span>{stepIndex + 1} / {steps.length}</span>
              <button type="button" disabled={stepIndex === 0} onClick={() => move(-1)}>Précédent</button>
              {stepIndex < steps.length - 1 ? <button type="button" onClick={() => move(1)}>Suivant</button> : <button type="button" onClick={close}>Commencer</button>}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
