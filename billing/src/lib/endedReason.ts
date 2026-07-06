/**
 * Translate VAPI's raw ended_reason values into human-readable labels.
 * Anything not in the map falls back to "Other".
 *
 * Source: https://docs.vapi.ai/api-reference/calls/get-call (endedReason enum).
 * Kept in lib (not in the component) so both CallsTable and CallDetailHeader
 * render identical labels for the same code.
 */

const MAP: Record<string, string> = {
  'customer-ended-call':                          'Completed (caller hung up)',
  'assistant-ended-call':                         'Completed',
  'assistant-ended-call-with-hangup-task':        'Completed',
  'assistant-said-end-call-phrase':               'Completed',
  'assistant-forwarded-call':                     'Transferred to human',
  'phone-call-provider-closed-websocket':         'Completed',
  'voicemail':                                    'Voicemail detected',
  'silence-timed-out':                            'Silence (no response)',
  'customer-busy':                                'Caller busy',
  'customer-did-not-answer':                      'No answer',
  'customer-did-not-give-microphone-permission':  'Microphone denied',
  'exceeded-max-duration':                        'Max duration reached',
  'manually-canceled':                            'Cancelled',
  'twilio-failed-to-connect-call':                'Connection failed',
  'pipeline-error-openai-llm-failed':             'Service error',
  'pipeline-error-deepgram-transcriber-failed':   'Service error',
  'pipeline-error-eleven-labs-voice-failed':      'Service error',
};

export function formatEndedReason(reason: string | null): string {
  if (!reason) return '—';
  if (MAP[reason]) return MAP[reason];
  if (reason.startsWith('call.start.error')) return 'Connection failed';
  if (reason.startsWith('pipeline-error'))   return 'Service error';
  return 'Other';
}

/**
 * True when the ended_reason indicates the call was forwarded to a human.
 * Only 'assistant-forwarded-call' counts as a transfer; other "assistant-ended-*"
 * reasons (including 'assistant-ended-call-with-hangup-task') are normal
 * completions and are labeled as such by MAP.
 * Used by the detail header to decide whether to show "Forwarded to: <number>".
 */
export function isForwardedReason(reason: string | null): boolean {
  return reason === 'assistant-forwarded-call';
}
