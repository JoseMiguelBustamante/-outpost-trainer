// Pure expedition progression. The caller persists stageIndex between frames
// and applies only completed rewards, so transient meter dips never undo stages.
import type { GameState } from '../sim';

export interface MissionStats {
  depositsCollected: number;
}

export type MissionStage = {
  id: string;
  title: string;
  detail: string;
  done(state: GameState, stats: MissionStats): boolean;
  rewardMaterials: number;
};

const STAGES: readonly MissionStage[] = [
  { id: 'establish', title: 'Establish the outpost', detail: 'collect 3 deposits',
    done: (_state, stats) => stats.depositsCollected >= 3, rewardMaterials: 15 },
  { id: 'sustain', title: 'Sustain the crew', detail: 'survive 1 storm with oxygen ≥60',
    done: (state) => state.stormsSurvived >= 1 && state.oxygen >= 60, rewardMaterials: 15 },
  { id: 'emergency', title: 'Survive the emergency', detail: 'survive 3 storms or the full cycle',
    done: (state) => state.stormsSurvived >= 3 || state.gameOverReason === 'survived', rewardMaterials: 20 },
];

export function missionProgress(state: GameState, stats: MissionStats, previousIndex = 0) {
  let stageIndex = previousIndex;
  while (stageIndex < STAGES.length && STAGES[stageIndex].done(state, stats)) stageIndex++;
  return {
    stageIndex,
    stages: STAGES.slice(0, Math.min(stageIndex + 1, STAGES.length)),
    allDone: stageIndex === STAGES.length,
    completed: STAGES.slice(previousIndex, stageIndex),
  };
}
