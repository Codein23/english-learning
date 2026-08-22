import { useCallback, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { isCardValidForSlot } from '@/quiz/check';
import type { MatchingAssignment } from '@/quiz/check';
import type { MatchingCard, MatchingQuestion } from '@/quiz/types';
import { cx } from '@/lib/cx';

type Role = 'past' | 'participle';

const ROLE_LABEL: Record<Role, string> = {
  past: 'Prétérit',
  participle: 'Participe',
};

/**
 * Mode Association (§6.1).
 * - clic-clic **et** glisser-déposer, les deux opérationnels ;
 * - ordre de pose libre : le participe peut être posé avant le prétérit ;
 * - formes identiques (`cut`/`cut`) : deux cartes distinctes, chacune assignable
 *   à un emplacement, jamais la même carte dans les deux.
 */
export function Matching({
  question,
  disabled,
  onComplete,
}: {
  question: MatchingQuestion;
  disabled: boolean;
  onComplete: (assignment: MatchingAssignment, mistakes: string[]) => void;
}) {
  const emptyAssignment = useMemo<MatchingAssignment>(
    () =>
      Object.fromEntries(
        question.slots.map((slot) => [slot.verbId, { past: null, participle: null }]),
      ),
    [question],
  );

  // Monté avec `key={question.id}` : chaque question repart d'un plateau vierge.
  const [assignment, setAssignment] = useState<MatchingAssignment>(emptyAssignment);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [errorCard, setErrorCard] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const completed = useRef(false);
  /** Verbes ayant reçu au moins une carte erronée : ils comptent comme ratés. */
  const mistakes = useRef(new Set<string>());

  const usedUids = useMemo(() => {
    const used = new Set<string>();
    for (const entry of Object.values(assignment)) {
      if (entry.past) used.add(entry.past);
      if (entry.participle) used.add(entry.participle);
    }
    return used;
  }, [assignment]);

  const tryAssign = useCallback(
    (verbId: string, role: Role, uid: string) => {
      if (disabled) return;
      const card = question.cards.find((candidate) => candidate.uid === uid);
      if (!card || usedUids.has(uid)) return;

      if (!isCardValidForSlot(question, verbId, role, card)) {
        // Erreur : secousse courte, la carte reste disponible.
        mistakes.current.add(verbId);
        setErrorCard(uid);
        setAnnouncement(`${card.text} ne convient pas pour ce ${ROLE_LABEL[role].toLowerCase()}.`);
        window.setTimeout(() => setErrorCard(null), 400);
        return;
      }

      setSelectedCard(null);
      setAnnouncement(`${card.text} associé — ${ROLE_LABEL[role].toLowerCase()}.`);
      setAssignment((current) => {
        const entry = current[verbId] ?? { past: null, participle: null };
        const next: MatchingAssignment = { ...current, [verbId]: { ...entry, [role]: uid } };

        const finished = question.slots.every((slot) => {
          const value = next[slot.verbId];
          return value?.past !== null && value?.participle !== null;
        });
        if (finished && !completed.current) {
          completed.current = true;
          // Sortie du cycle de rendu : le parent enregistre la réponse.
          window.setTimeout(() => onComplete(next, [...mistakes.current]), 0);
        }
        return next;
      });
    },
    [disabled, onComplete, question, usedUids],
  );

  const cardByUid = useMemo(
    () => new Map(question.cards.map((card) => [card.uid, card])),
    [question],
  );

  return (
    <div className="space-y-6">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ul className="space-y-2">
        {question.slots.map((slot) => {
          const entry = assignment[slot.verbId] ?? { past: null, participle: null };
          const locked = entry.past !== null && entry.participle !== null;

          return (
            <li
              key={slot.verbId}
              className={cx(
                'rounded-[var(--radius-card)] border bg-surface px-3 py-3 transition-colors duration-150 ease-out',
                locked ? 'border-success' : 'border-border',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span lang="en" className="min-w-24 text-lg font-semibold">
                  {slot.base}
                </span>

                {(['past', 'participle'] as Role[]).map((role) => (
                  <Slot
                    key={role}
                    role={role}
                    verbId={slot.verbId}
                    card={entry[role] ? (cardByUid.get(entry[role]) ?? null) : null}
                    disabled={disabled}
                    hasSelection={selectedCard !== null}
                    onDrop={(uid) => tryAssign(slot.verbId, role, uid)}
                    onClick={() => {
                      if (selectedCard) tryAssign(slot.verbId, role, selectedCard);
                    }}
                  />
                ))}

                {locked ? (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-2xs font-medium text-success-text">
                    <Check aria-hidden="true" className="size-3" strokeWidth={2} />
                    Complet
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <p className="text-xs text-muted">
          Sélectionne une forme, puis son emplacement — ou fais-la glisser. L'ordre entre
          prétérit et participe n'a pas d'importance.
        </p>
        <ul className="flex flex-wrap gap-2">
          {question.cards.map((card) => {
            const used = usedUids.has(card.uid);
            if (used) return null;
            const selected = selectedCard === card.uid;
            return (
              <li key={card.uid}>
                <button
                  type="button"
                  draggable={!disabled}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', card.uid);
                    setSelectedCard(card.uid);
                  }}
                  onClick={() => setSelectedCard(selected ? null : card.uid)}
                  disabled={disabled}
                  aria-pressed={selected}
                  className={cx(
                    'inline-flex h-11 items-center rounded-[var(--radius-field)] border px-4 text-base font-medium transition-colors duration-150 ease-out disabled:opacity-50',
                    selected
                      ? 'border-accent bg-accent-subtle text-accent-text'
                      : 'border-border bg-surface hover:border-border-strong',
                    errorCard === card.uid && 'motion-safe:animate-[shake_0.32s_ease-out] border-danger text-danger-text',
                  )}
                  lang="en"
                >
                  {card.text}
                  {errorCard === card.uid ? (
                    <X aria-hidden="true" className="ml-1.5 size-4" strokeWidth={2} />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Slot({
  role,
  verbId,
  card,
  disabled,
  hasSelection,
  onDrop,
  onClick,
}: {
  role: Role;
  verbId: string;
  card: MatchingCard | null;
  disabled: boolean;
  hasSelection: boolean;
  onDrop: (uid: string) => void;
  onClick: () => void;
}) {
  const [over, setOver] = useState(false);
  const filled = card !== null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || filled}
      onDragOver={(event) => {
        if (filled) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const uid = event.dataTransfer.getData('text/plain');
        if (uid) onDrop(uid);
      }}
      className={cx(
        'inline-flex h-11 min-w-32 items-center justify-center rounded-[var(--radius-field)] border px-3 text-base transition-colors duration-150 ease-out',
        filled
          ? 'border-success bg-success-subtle font-medium text-success-text'
          : over || hasSelection
            ? 'border-accent border-dashed bg-accent-subtle text-accent-text'
            : 'border-border border-dashed text-muted',
      )}
    >
      {filled ? (
        <span lang="en">{card.text}</span>
      ) : (
        <span className="text-sm">{ROLE_LABEL[role]}</span>
      )}
      <span className="sr-only">
        {filled
          ? `${ROLE_LABEL[role]} de ${verbId} : ${card.text}`
          : `Emplacement ${ROLE_LABEL[role]} de ${verbId}, vide`}
      </span>
    </button>
  );
}
