import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@fontsource-variable/archivo';
import './styles/index.css';
import { router } from './router';

const container = document.getElementById('root');
if (!container) throw new Error('#root introuvable dans index.html');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
