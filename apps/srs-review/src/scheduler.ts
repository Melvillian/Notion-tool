import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';
import type { SRSCard } from './types.js';

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true,
  enable_short_term: true,
});

export function createNewFSRSCard(): Partial<SRSCard> {
  const card = createEmptyCard();
  return fsrsCardToFields(card);
}

export function gradeCard(srsCard: SRSCard, grade: 'Hard' | 'Good' | 'Easy'): Partial<SRSCard> {
  const card: Card = {
    due: new Date(srsCard.due),
    stability: srsCard.stability,
    difficulty: srsCard.difficulty,
    elapsed_days: srsCard.elapsed_days,
    scheduled_days: srsCard.scheduled_days,
    reps: srsCard.reps,
    lapses: srsCard.lapses,
    state: srsCard.state as any,
    last_review: srsCard.last_review ? new Date(srsCard.last_review) : undefined as any,
  };

  const rating = gradeToRating(grade);
  const result = scheduler.next(card, new Date(), rating);
  return fsrsCardToFields(result.card);
}

function gradeToRating(grade: 'Hard' | 'Good' | 'Easy'): Rating {
  switch (grade) {
    case 'Hard': return Rating.Hard;
    case 'Good': return Rating.Good;
    case 'Easy': return Rating.Easy;
  }
}

function fsrsCardToFields(card: Card): Partial<SRSCard> {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}
