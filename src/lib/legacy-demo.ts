// Retain old reader URLs without presenting generated prose as published books
// or deleting personal library entries, notes or progress.
const legacyTitles: Record<string, string> = {
  "casa-espiritos": "A Casa dos Espíritos",
  "vento-do-norte": "O Vento do Norte",
  "arquivo-das-horas": "O Arquivo das Horas",
};

export function legacyDemoTitle(id: string): string | null {
  return Object.hasOwn(legacyTitles, id) ? legacyTitles[id] : null;
}
