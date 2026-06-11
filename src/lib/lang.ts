/** Detects whether text is predominantly Bangla or English. */
export function detectLanguage(text: string): "bn" | "en" {
  let bangla = 0;
  let latin = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0980 && code <= 0x09ff) bangla++;
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) latin++;
  }
  return bangla > latin ? "bn" : "en";
}
