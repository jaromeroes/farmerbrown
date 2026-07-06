/**
 * Parse VAPI's `transcript` string into a list of speaker turns.
 *
 * Format observed: lines like "AI: …" or "User: …" newline-separated.
 * Continuation lines (no prefix) belong to the previous turn.
 *
 * Speaker label rewriting (AI → Agent, User → Caller) is done here so the
 * component just renders.
 */

export interface TranscriptTurn {
  speaker: string;
  text: string;
}

const TURN_BOUNDARY = /^([A-Za-z][A-Za-z0-9_-]{0,31}):\s+(.*)$/;

const SPEAKER_RENAME: Record<string, string> = {
  AI:   'Agent',
  User: 'Caller',
};

export function parseTranscript(input: string | null | undefined): TranscriptTurn[] {
  if (typeof input !== 'string' || input.length === 0) return [];

  const turns: TranscriptTurn[] = [];

  for (const rawLine of input.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const match = line.match(TURN_BOUNDARY);
    if (match) {
      const rawSpeaker = match[1];
      const text = match[2];
      const speaker = SPEAKER_RENAME[rawSpeaker] ?? rawSpeaker;
      turns.push({ speaker, text });
    } else if (turns.length > 0) {
      const last = turns[turns.length - 1];
      last.text = `${last.text} ${line}`;
    }
  }

  return turns;
}
