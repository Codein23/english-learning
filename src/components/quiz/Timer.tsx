import { useEffect, useRef, useState } from 'react';

/**
 * Minuteur par question : anneau de progression + décompte en chiffres tabulaires.
 * La transition est linéaire — seul cas où `linear` est légitime dans ce projet.
 * `onExpire` n'est appelé qu'une fois par question.
 */
export function QuestionTimer({
  seconds,
  questionId,
  paused,
  onExpire,
}: {
  seconds: number;
  questionId: string;
  paused: boolean;
  onExpire: () => void;
}) {
  // Le composant est monté avec `key={question.id}` : l'état repart de zéro
  // à chaque question, sans effet de remise à zéro.
  const [remaining, setRemaining] = useState(seconds);
  const fired = useRef(false);

  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const left = seconds - (Date.now() - startedAt) / 1000;
      setRemaining(Math.max(0, left));
      if (left <= 0 && !fired.current) {
        fired.current = true;
        window.clearInterval(id);
        onExpire();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [onExpire, paused, questionId, seconds]);

  const ratio = seconds === 0 ? 0 : remaining / seconds;
  const circumference = 2 * Math.PI * 14;

  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-8" role="img" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="none" stroke="var(--color-border)" strokeWidth="3" />
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke={ratio < 0.25 ? 'var(--color-danger)' : 'var(--color-accent)'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform="rotate(-90 16 16)"
        />
      </svg>
      <span className="tnum text-sm text-muted">
        {Math.ceil(remaining)} s<span className="sr-only"> restantes</span>
      </span>
    </div>
  );
}

/** Minuteur global de session. */
export function SessionTimer({
  seconds,
  startedAt,
  onExpire,
}: {
  seconds: number;
  startedAt: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const fired = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      const left = seconds - (Date.now() - startedAt) / 1000;
      setRemaining(Math.max(0, left));
      if (left <= 0 && !fired.current) {
        fired.current = true;
        window.clearInterval(id);
        onExpire();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [onExpire, seconds, startedAt]);

  const minutes = Math.floor(remaining / 60);
  const rest = Math.floor(remaining % 60);

  return (
    <span className="tnum text-sm text-muted">
      {minutes}:{String(rest).padStart(2, '0')}
      <span className="sr-only"> restantes dans la session</span>
    </span>
  );
}
