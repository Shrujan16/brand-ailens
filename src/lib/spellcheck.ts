/**
 * Loads the English nspell dictionary in the browser (lazily, once) for the Spelling & Grammar check.
 * The dictionary files ship as static assets so they never enter the server bundle.
 */
import type { SpellChecker } from "@/lib/brand-engine";
import affUrl from "../../node_modules/dictionary-en/index.aff?url";
import dicUrl from "../../node_modules/dictionary-en/index.dic?url";

let pending: Promise<SpellChecker> | null = null;

export function loadSpellChecker(): Promise<SpellChecker> {
  if (!pending) {
    pending = (async () => {
      const [{ default: nspell }, aff, dic] = await Promise.all([
        import("nspell"),
        fetch(affUrl).then((r) => r.text()),
        fetch(dicUrl).then((r) => r.text()),
      ]);
      const dictionary = nspell(aff, dic);
      const correct = new Map<string, boolean>();
      const suggestions = new Map<string, string[]>();
      return {
        correct(word) {
          let ok = correct.get(word);
          if (ok === undefined) correct.set(word, (ok = dictionary.correct(word)));
          return ok;
        },
        suggest(word) {
          let list = suggestions.get(word);
          if (!list) suggestions.set(word, (list = dictionary.suggest(word).slice(0, 3)));
          return list;
        },
      };
    })();
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}
