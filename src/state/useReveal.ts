// Drives a single player's self-paced reveal: which team is next, the lottery
// "spin" animation, and marking each team revealed once it settles.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Assignment, Team } from '../domain/types';
import { revealOrder } from '../domain/draw';

const BUCKET_LABELS: Record<number, string> = {
  1: 'your top seed',
  2: 'the contenders',
  3: 'the dark horses',
  4: 'the long shots',
};

export interface RevealStep {
  assignment: Assignment;
  team: Team;
}

interface UseRevealArgs {
  assignments: Assignment[];
  teams: Team[];
  playerId: string | null;
  onReveal: (playerId: string, teamIds: string[]) => Promise<void>;
}

export function useReveal({ assignments, teams, playerId, onReveal }: UseRevealArgs) {
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const steps = useMemo<RevealStep[]>(() => {
    if (!playerId) return [];
    return revealOrder(assignments, playerId)
      .map((assignment) => {
        const team = teamById.get(assignment.teamId);
        return team ? { assignment, team } : null;
      })
      .filter((step): step is RevealStep => step !== null);
  }, [assignments, playerId, teamById]);

  const revealedCount = steps.filter((step) => step.assignment.revealedAt !== null).length;
  const [cursor, setCursor] = useState(revealedCount);
  const [spinning, setSpinning] = useState(false);
  const [litCountry, setLitCountry] = useState<string | null>(null);
  const [settled, setSettled] = useState<RevealStep | null>(null);
  const timers = useRef<number[]>([]);

  const nextStep = steps[cursor] ?? null;
  const complete = cursor >= steps.length;

  const bucketLabel = nextStep
    ? `Bucket ${nextStep.assignment.bucket} — ${BUCKET_LABELS[nextStep.assignment.bucket] ?? ''}`
    : 'Complete';

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  // Clear any in-flight animation timers when the screen unmounts.
  useEffect(() => clearTimers, []);

  // Map names to roam across while "spinning". Real countries from the field.
  const roam = useMemo(() => teams.map((team) => team.mapName ?? team.name), [teams]);

  const spin = useCallback(() => {
    if (!nextStep || spinning || !playerId) return;
    setSpinning(true);
    setSettled(null);

    const target = nextStep.team.mapName ?? nextStep.team.name;
    const total = 24;
    let count = 0;

    const flash = () => {
      const name = count >= total - 1 ? target : roam[Math.floor(Math.random() * roam.length)]!;
      setLitCountry(name);
      count += 1;
      if (count >= total) {
        setSpinning(false);
        setSettled(nextStep);
        void onReveal(playerId, [nextStep.assignment.teamId]).then(() => {
          setCursor((value) => value + 1);
        });
        return;
      }
      const progress = count / total;
      const delay = 55 + progress ** 3 * 360; // ease out
      timers.current.push(window.setTimeout(flash, delay));
    };

    flash();
  }, [nextStep, onReveal, playerId, roam, spinning]);

  return { steps, nextStep, cursor, complete, spinning, litCountry, settled, bucketLabel, spin };
}
