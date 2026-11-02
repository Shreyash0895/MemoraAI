/* Reads text aloud with the browser's built-in voice (no data leaves the device). Quietly does nothing if unsupported. */
export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

export function speak(text) {
  if (!canSpeak || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.85; // slower than normal
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel();
}
