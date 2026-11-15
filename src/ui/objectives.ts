import type { GameState } from '../sim';
import type { MissionStats, MissionStage } from '../game/missions';
import { missionProgress } from '../game/missions';

/** Read-only objective status, mounted in the mission banner's normal flow. */
export function createObjectives(container: HTMLElement) {
  const root = document.createElement('section');
  root.className = 'hud-objectives';
  root.setAttribute('aria-label', 'Objetivos de la expedición');
  root.setAttribute('aria-live', 'polite');
  const goal = document.createElement('p');
  const celebration = document.createElement('p');
  celebration.className = 'objective-celebration';
  root.append(goal, celebration);
  container.appendChild(root);
  let celebrationUntil = 0;
  return {
    celebrate(stage: MissionStage, now: number) {
      celebration.textContent = `✔ ¡Etapa completa! +${stage.rewardMaterials} materiales`;
      celebrationUntil = now + 4000;
    },
    update(state: GameState, stats: MissionStats, progress: ReturnType<typeof missionProgress>, now: number) {
      const stage = progress.stages[progress.stageIndex];
      const count = progress.stageIndex === 0 ? ` (${Math.min(stats.depositsCollected, 3)}/3)`
        : progress.stageIndex === 1 ? ` (${Math.min(state.stormsSurvived, 1)}/1 · oxígeno ${Math.floor(state.oxygen)}/60)`
        : ` (${Math.min(state.stormsSurvived, 3)}/3)`;
      const text = progress.allDone ? '🏆 Todas las etapas completas — ¡sobrevive el ciclo nocturno!'
        : `${['①', '②', '③'][progress.stageIndex]} ${stage.title} — ${stage.detail}${count}`;
      if (goal.textContent !== text) goal.textContent = text;
      if (now >= celebrationUntil && celebration.textContent) celebration.textContent = '';
    },
    reset() {
      goal.textContent = '';
      celebration.textContent = '';
      celebrationUntil = 0;
    },
  };
}
