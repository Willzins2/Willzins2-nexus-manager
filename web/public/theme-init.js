// Aplica o tema antes do React carregar (evita "piscar" branco no modo escuro).
(function () {
  try {
    var t = localStorage.getItem('nexus-theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
