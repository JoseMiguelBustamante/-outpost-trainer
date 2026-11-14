// Lunar Outpost Trainer — entry point.
// T2 will replace this placeholder with the real 3D scene (terrain + outpost).

const APP_ROOT = document.getElementById('app');

function boot(): void {
  if (!APP_ROOT) throw new Error('#app root element not found');
  const hud = document.getElementById('hud');
  if (hud) {
    hud.textContent = 'Lunar Outpost Trainer — scaffold OK (scene arrives in T2)';
  }
}

boot();
