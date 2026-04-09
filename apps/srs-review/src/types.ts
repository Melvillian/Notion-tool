export interface NotionPage {
  id: string;
  lastEditedTime: string;
  title: string;
}

export interface NotionBlock {
  id: string;
  type: string;
  plainText: string;
  richText: RichTextItem[];
}

export interface RichTextItem {
  type: string;
  text?: { content: string; link: string | null };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
}

export interface SRSCard {
  id: string;
  source_page_id: string;
  source_block_id: string;
  question: string;
  answer: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelevanceResult {
  isPolitical: boolean;
  isFactualClaim: boolean;
}

export interface CardGenerationResult {
  question: string;
  answer: string;
}

export type UserGrade = 'Hard' | 'Good' | 'Easy';
