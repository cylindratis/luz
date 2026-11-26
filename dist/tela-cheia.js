export function initFullscreen(button, onChange = () => {}) {
  const panel = button.closest('article');
  const label = button.querySelector('span');
  let active = false;

  function sync() {
    const expanded = document.fullscreenElement === panel || panel.classList.contains('panel-expanded');
    if (active === expanded) return;
    active = expanded;
    button.setAttribute('aria-pressed', String(active));
    label.textContent = active ? 'sair da tela cheia' : 'tela cheia';
    if (button.hasAttribute('title')) button.title = label.textContent;
    button.querySelector('use').setAttribute('href', active ? '#i-collapse' : '#i-fullscreen');
    onChange(active);
    button.focus({ preventScroll: true });
  }

  button.addEventListener('click', async () => {
    if (document.fullscreenElement === panel) await document.exitFullscreen();
    else if (active) panel.classList.remove('panel-expanded');
    else {
      try {
        await panel.requestFullscreen();
      } catch {
        panel.classList.add('panel-expanded');
      }
    }
    sync();
  });
  document.addEventListener('fullscreenchange', sync);
  panel.addEventListener('keydown', event => {
    if (!panel.classList.contains('panel-expanded')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      panel.classList.remove('panel-expanded');
      sync();
    }
    if (event.key !== 'Tab') return;
    const controls = [...panel.querySelectorAll('button, select, input, summary, [tabindex="0"]')]
      .filter(el => !el.disabled && el.getClientRects().length);
    const edge = event.shiftKey ? controls[0] : controls.at(-1);
    if (event.target === edge) {
      event.preventDefault();
      (event.shiftKey ? controls.at(-1) : controls[0]).focus();
    }
  });
}
