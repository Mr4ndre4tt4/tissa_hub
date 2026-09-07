import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/tokens.css';
import { App } from './app/App';
import { ProvedorApp } from './app/estado';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento raiz não encontrado.');

createRoot(raiz).render(
  <StrictMode>
    <ProvedorApp>
      <App />
    </ProvedorApp>
  </StrictMode>,
);
