import { useState } from 'react';
import type { FlashcardQuestion } from '@/quiz/types';
import { SpeakButton } from '@/components/ui/SpeakButton';
import { formatVariants } from '@/lib/format';
import { Button } from '@/components/ui/Button';

/** Flashcards + SRS (§6.8) : recto base, verso formes, auto-évaluation 3 niveaux. */
export function Flashcard({
  question,
  disabled,
  onRate,
}: {
  question: FlashcardQuestion;
  disabled: boolean;
  onRate: (rating: 'again' | 'good' | 'easy') => void;
}) {
  // Monté avec `key={question.id}` : la carte repart toujours côté recto.
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <p lang="en" className="text-3xl font-bold">
            {question.base}
          </p>
          <SpeakButton
            sequence={[
              { text: question.base, role: 'base' },
              { text: question.past[0] ?? '', role: 'past' },
              { text: question.participle[0] ?? '', role: 'participle' },
            ]}
            label="Écouter les trois formes"
            size="sm"
          />
        </div>

        {flipped ? (
          <dl className="mx-auto mt-6 max-w-sm space-y-2 text-left">
            <Row label="Prétérit" value={formatVariants(question.past)} lang="en" />
            <Row label="Participe" value={formatVariants(question.participle)} lang="en" />
            <Row label="Traduction" value={question.fr.join(', ')} />
          </dl>
        ) : (
          <p className="mt-6 text-sm text-muted">Récite les formes, puis retourne la carte.</p>
        )}
      </div>

      {flipped ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => onRate('again')} disabled={disabled}>
            Encore
          </Button>
          <Button onClick={() => onRate('good')} disabled={disabled}>
            Correct
          </Button>
          <Button variant="primary" onClick={() => onRate('easy')} disabled={disabled}>
            Facile
          </Button>
        </div>
      ) : (
        <Button variant="primary" onClick={() => setFlipped(true)} disabled={disabled}>
          Retourner la carte
        </Button>
      )}
    </div>
  );
}

function Row({ label, value, lang }: { label: string; value: string; lang?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-1.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd lang={lang} className="text-base font-semibold">
        {value}
      </dd>
    </div>
  );
}
