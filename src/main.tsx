import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const POLLOS_DB_NAME = 'pollos-offline-db';
const FORCE_RESET_KEY = 'pollos.forceResetDb';

function deleteIndexedDb(databaseName: string): Promise<void> {
  if (!('indexedDB' in window)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('La base local esta bloqueada por otra pestana. Cierra otras ventanas de POLLOS y vuelve a cargar.'));
      }
    }, 5000);

    const request = indexedDB.deleteDatabase(databaseName);

    request.onsuccess = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(request.error ?? new Error('No se pudo borrar la base local.'));
    };
  });
}

function renderFatalBootError(error: unknown) {
  const root = document.getElementById('root');
  if (!root) return;
  const message = error instanceof Error ? error.message : 'No se pudo iniciar POLLOS.';
  root.innerHTML = `
    <div class="boot-screen boot-screen--error">
      <div>
        <strong>No se pudo cargar POLLOS</strong>
        <span>${message}</span>
        <button id="pollos-reset-db" type="button">Restaurar base local</button>
      </div>
    </div>
  `;
  document.getElementById('pollos-reset-db')?.addEventListener('click', () => {
    localStorage.setItem(FORCE_RESET_KEY, '1');
    window.location.href = `${window.location.origin}${window.location.pathname}?resetDb=1`;
  });
}

async function prepareLocalStorage() {
  const url = new URL(window.location.href);
  const mustReset = url.searchParams.get('resetDb') === '1' || localStorage.getItem(FORCE_RESET_KEY) === '1';
  if (!mustReset) return;

  localStorage.removeItem(FORCE_RESET_KEY);
  await deleteIndexedDb(POLLOS_DB_NAME);
  url.searchParams.delete('resetDb');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

async function startApp() {
  await prepareLocalStorage();
  const [{ App }, { registerServiceWorker }] = await Promise.all([import('./App'), import('./services/pwaService')]);
  registerServiceWorker();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startApp().catch(renderFatalBootError);
