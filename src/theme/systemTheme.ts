export function applySystemTheme(tipo?: string | null) {
  const root = document.documentElement;
  if (tipo === 'MERCERIA') {
    root.dataset.theme = 'merceria';
  } else if (tipo === 'COMERCIALIZADORA') {
    root.dataset.theme = 'comercializadora';
  } else {
    delete root.dataset.theme;
  }
}
