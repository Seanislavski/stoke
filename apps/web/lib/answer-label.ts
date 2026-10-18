// "3 answers", or "1 answer (yours)" / "13 answers (including yours)" when the viewer
// is one of the authors. Shared by the Q&A list and the Featured Question card.
export function answerCountLabel(count: number, includesMine: boolean): string {
  const base = `${count} ${count === 1 ? 'answer' : 'answers'}`
  if (!includesMine) return base
  return count === 1 ? `${base} (yours)` : `${base} (including yours)`
}
