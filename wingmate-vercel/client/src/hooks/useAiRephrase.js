// client/src/hooks/useAiRephrase.js
// Debounced hook for the onboarding situation field
// Calls POST /api/ai/rephrase and caches results to avoid redundant API calls

import { useState, useRef, useCallback } from 'react';
import { ai } from '../lib/api';

const cache = new Map(); // simple in-memory cache

export function useAiRephrase(debounceMs = 900) {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading]       = useState(false);
  const timerRef = useRef(null);
  const lastText = useRef('');

  const rephrase = useCallback((text) => {
    clearTimeout(timerRef.current);
    const trimmed = text.trim();

    if (trimmed.length < 15) {
      setSuggestion('');
      return;
    }

    // Don't re-fetch if text hasn't changed meaningfully
    if (trimmed === lastText.current) return;

    // Check cache
    if (cache.has(trimmed)) {
      setSuggestion(cache.get(trimmed));
      lastText.current = trimmed;
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { rephrased } = await ai.rephrase(trimmed);
        if (rephrased) {
          cache.set(trimmed, rephrased);
          setSuggestion(rephrased);
          lastText.current = trimmed;
        }
      } catch {
        // non-fatal — AI is optional
      } finally {
        setLoading(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  const clear = useCallback(() => {
    setSuggestion('');
    lastText.current = '';
  }, []);

  return { suggestion, loading, rephrase, clear };
}
