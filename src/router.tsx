import { createHashRouter } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { HomePage } from '@/pages/Home';
import { VerbsPage } from '@/pages/Verbs';
import { VerbDetailPage } from '@/pages/VerbDetail';
import { CreditsPage, StatsPage } from '@/pages/Placeholders';
import { QuizSetupPage } from '@/pages/QuizSetup';
import { QuizRunPage } from '@/pages/QuizRun';
import { QuizResultPage } from '@/pages/QuizResult';
import { SettingsPage } from '@/pages/Settings';
import { NotFoundPage } from '@/pages/NotFound';

/**
 * Routeur en mode hash : l'application est servie sous le sous-chemin
 * `/english-learning/` sur GitHub Pages, et tous les deep-links doivent
 * résoudre sans configuration serveur.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'verbs', element: <VerbsPage /> },
      { path: 'verbs/:id', element: <VerbDetailPage /> },
      { path: 'quiz', element: <QuizSetupPage /> },
      { path: 'quiz/run', element: <QuizRunPage /> },
      { path: 'quiz/result', element: <QuizResultPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'credits', element: <CreditsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
