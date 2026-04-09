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

export interface RelevanceResult {
  isPolitical: boolean;
  isFalsifiableClaim: boolean;
}

export interface Claim {
  claim_text: string;
  tag: 'Plausible' | 'Uncertain' | 'Implausible';
  evidence_summary: string;
  sources: string[];
}

export interface PlausibilityResult {
  claims: Claim[];
}
