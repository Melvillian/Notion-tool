import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { SRSCard } from './types.js';

export class SRSDatabase {
  private db: Database;

  constructor(dbPath: string = './data/srs.db') {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        source_page_id TEXT NOT NULL,
        source_block_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        due TEXT NOT NULL,
        stability REAL NOT NULL,
        difficulty REAL NOT NULL,
        elapsed_days INTEGER NOT NULL,
        scheduled_days INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        lapses INTEGER NOT NULL,
        state INTEGER NOT NULL,
        last_review TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_cards_source_page ON cards(source_page_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_cards_source_block ON cards(source_block_id)`);
  }

  cardExistsForBlock(blockId: string): boolean {
    const row = this.db.query('SELECT id FROM cards WHERE source_block_id = ?').get(blockId);
    return row !== null;
  }

  insertCard(card: SRSCard): void {
    this.db.run(`
      INSERT INTO cards (
        id, source_page_id, source_block_id, question, answer,
        due, stability, difficulty, elapsed_days, scheduled_days,
        reps, lapses, state, last_review, created_at, updated_at
      ) VALUES (
        $id, $source_page_id, $source_block_id, $question, $answer,
        $due, $stability, $difficulty, $elapsed_days, $scheduled_days,
        $reps, $lapses, $state, $last_review, $created_at, $updated_at
      )
    `, {
      $id: card.id,
      $source_page_id: card.source_page_id,
      $source_block_id: card.source_block_id,
      $question: card.question,
      $answer: card.answer,
      $due: card.due,
      $stability: card.stability,
      $difficulty: card.difficulty,
      $elapsed_days: card.elapsed_days,
      $scheduled_days: card.scheduled_days,
      $reps: card.reps,
      $lapses: card.lapses,
      $state: card.state,
      $last_review: card.last_review,
      $created_at: card.created_at,
      $updated_at: card.updated_at,
    });
  }

  getDueCards(): SRSCard[] {
    return this.db.query(
      `SELECT * FROM cards WHERE due <= ? ORDER BY due ASC`
    ).all(new Date().toISOString()) as SRSCard[];
  }

  getCardById(id: string): SRSCard | null {
    return this.db.query('SELECT * FROM cards WHERE id = ?').get(id) as SRSCard | null;
  }

  updateCard(card: SRSCard): void {
    this.db.run(`
      UPDATE cards SET
        due = $due,
        stability = $stability,
        difficulty = $difficulty,
        elapsed_days = $elapsed_days,
        scheduled_days = $scheduled_days,
        reps = $reps,
        lapses = $lapses,
        state = $state,
        last_review = $last_review,
        updated_at = datetime('now')
      WHERE id = $id
    `, {
      $id: card.id,
      $due: card.due,
      $stability: card.stability,
      $difficulty: card.difficulty,
      $elapsed_days: card.elapsed_days,
      $scheduled_days: card.scheduled_days,
      $reps: card.reps,
      $lapses: card.lapses,
      $state: card.state,
      $last_review: card.last_review,
    });
  }
}
