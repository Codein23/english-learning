import type { HuitoGroup, Pattern, Verb, VerbForm } from '@/data/schema';

/** Les neuf modes du §6. `speed` est un mode de session, pas un type de question. */
export const QUIZ_MODES = [
  'matching',
  'mcq',
  'free',
  'triplet',
  'translation',
  'speed',
  'dictation',
  'flashcard',
  'patternSort',
] as const;

export type QuizMode = (typeof QUIZ_MODES)[number];

export const MODE_LABEL: Record<QuizMode, string> = {
  matching: 'Association',
  mcq: 'QCM',
  free: 'Saisie libre',
  triplet: 'Complétion de triplet',
  translation: 'Traduction',
  speed: 'Speed Run',
  dictation: 'Dictée audio',
  flashcard: 'Flashcards',
  patternSort: 'Tri par schéma',
};

export const MODE_DESCRIPTION: Record<QuizMode, string> = {
  matching: 'Relier chaque base à son prétérit et à son participe, dans n’importe quel ordre.',
  mcq: 'Choisir la bonne forme parmi quatre propositions plausibles.',
  free: 'Taper le prétérit et le participe de mémoire.',
  triplet: 'Une forme est donnée, compléter les deux autres.',
  translation: 'Passer du français à l’anglais, ou l’inverse.',
  speed: 'Flux continu chronométré, combo au-delà de 5 bonnes réponses d’affilée.',
  dictation: 'Écouter une forme et l’identifier.',
  flashcard: 'Recto/verso avec auto-évaluation, alimente les boîtes SRS.',
  patternSort: 'Classer les verbes dans les cinq schémas de conjugaison.',
};

export type Direction = 'en-en' | 'fr-en' | 'en-fr' | 'mixed';
export type Difficulty = 'easy' | 'normal' | 'expert';

export type ScopeKind =
  | { kind: 'all' }
  | { kind: 'tier'; tiers: (1 | 2 | 3)[] }
  | { kind: 'pattern'; patterns: Pattern[] }
  | { kind: 'group'; groups: HuitoGroup[] }
  | { kind: 'favorites' }
  | { kind: 'mistakes' }
  | { kind: 'manual'; verbIds: string[] };

export interface QuizConfig {
  modes: QuizMode[];
  questionCount: number;
  /** Secondes par question, `null` = pas de minuteur. */
  perQuestionSeconds: number | null;
  /** Secondes pour toute la session, `null` = pas de minuteur global. */
  sessionSeconds: number | null;
  scope: ScopeKind;
  direction: Direction;
  difficulty: Difficulty;
  /** Taille d'un lot en mode Association et Tri par schéma. */
  batchSize: 4 | 6 | 8;
  audioOnReveal: boolean;
  firstLetterHint: boolean;
  /** Correction immédiate, ou tout à la fin de la session. */
  immediateFeedback: boolean;
  shuffle: boolean;
  /** Pondération SRS : privilégier les verbes faibles et les verbes dus. */
  srsWeighting: boolean;
  /** Autorise la répétition d'un verbe quand le périmètre est trop petit. */
  allowRepeats: boolean;
  seed: number;
}

export const DEFAULT_CONFIG: QuizConfig = {
  modes: ['matching'],
  questionCount: 25,
  perQuestionSeconds: null,
  sessionSeconds: null,
  scope: { kind: 'all' },
  direction: 'en-en',
  difficulty: 'normal',
  batchSize: 4,
  audioOnReveal: true,
  firstLetterHint: false,
  immediateFeedback: true,
  shuffle: true,
  srsWeighting: true,
  allowRepeats: false,
  seed: 0,
};

export const PRESETS: { id: string; label: string; patch: Partial<QuizConfig> }[] = [
  { id: 'express', label: 'Express 10', patch: { questionCount: 10, perQuestionSeconds: 15 } },
  { id: 'standard', label: 'Standard 25', patch: { questionCount: 25, perQuestionSeconds: null } },
  { id: 'marathon', label: 'Marathon 50', patch: { questionCount: 50, perQuestionSeconds: null } },
];

/** Une carte du pool en mode Association. */
export interface MatchingCard {
  /** Identifiant unique de carte : `cut` apparaît deux fois avec deux uid distincts. */
  uid: string;
  text: string;
  /** Verbe d'origine ; `null` pour un distracteur (variante Expert). */
  verbId: string | null;
  role: Extract<VerbForm, 'past' | 'participle'>;
}

export interface MatchingSlot {
  verbId: string;
  base: string;
  /** Formes acceptées pour le prétérit et pour le participe. */
  past: string[];
  participle: string[];
}

interface BaseQuestion {
  id: string;
  mode: QuizMode;
  /** Verbes concernés : un seul, sauf pour les modes par lot. */
  verbIds: string[];
}

export interface MatchingQuestion extends BaseQuestion {
  mode: 'matching';
  slots: MatchingSlot[];
  cards: MatchingCard[];
}

export interface McqQuestion extends BaseQuestion {
  mode: 'mcq' | 'dictation' | 'translation' | 'speed';
  prompt: string;
  /** Langue du texte de l'énoncé, pour `lang=` et la synthèse vocale. */
  promptLang: 'fr' | 'en';
  /** Forme à prononcer en mode Dictée. */
  spoken?: string;
  choices: string[];
  /** Toutes les réponses acceptées (variantes comprises). */
  accepted: string[];
  choicesLang: 'fr' | 'en';
}

export interface InputQuestion extends BaseQuestion {
  mode: 'free' | 'triplet' | 'translation' | 'speed' | 'dictation';
  prompt: string;
  promptLang: 'fr' | 'en';
  spoken?: string;
  /** Un champ par forme demandée. */
  fields: { key: VerbForm; label: string; accepted: string[] }[];
}

export interface FlashcardQuestion extends BaseQuestion {
  mode: 'flashcard';
  base: string;
  past: string[];
  participle: string[];
  fr: string[];
}

export interface PatternSortQuestion extends BaseQuestion {
  mode: 'patternSort';
  items: { verbId: string; base: string; past: string; participle: string; pattern: Pattern }[];
}

export type Question =
  | MatchingQuestion
  | McqQuestion
  | InputQuestion
  | FlashcardQuestion
  | PatternSortQuestion;

export type AnswerKind =
  | 'correct'
  | 'wrong'
  | 'near-spelling'
  | 'timeout'
  | 'partial'
  | 'skipped';

export interface CheckResult {
  correct: boolean;
  kind: AnswerKind;
  /** Réponse attendue, en clair, telle qu'affichée en correction. */
  expected: string;
  /** Piège pédagogique du verbe, affiché dès que le verbe est raté. */
  note: string | null;
  /** Détail par champ pour les modes multi-champs. */
  perField?: { key: VerbForm; correct: boolean; kind: AnswerKind; expected: string }[];
}

export interface AttemptRecord {
  questionId: string;
  verbIds: string[];
  mode: QuizMode;
  result: CheckResult;
  ms: number;
  usedHint: boolean;
  points: number;
}

/** Contexte de progression utilisé par la pondération SRS du générateur. */
export interface ProgressSnapshot {
  byVerb: Record<
    string,
    { attempts: number; correct: number; streak: number; box: number; lastSeen: number | null }
  >;
  favorites: string[];
  mistakeVerbIds: string[];
}

export type { Verb };
