// Why this exists: opens a PRO exercise for a visitor who has PRO. The page is
// built without the answers; this fetches them from /api/exercises/, fills the
// hint and the Answer tab, removes the paywall and starts the exercise.
// shortcut: the sheet and checks are in the page and only hidden; the answers
// are the part kept on the server. Move the whole sheet behind the API if that
// ever matters.
import { loadMe } from "./session.ts";

const root = document.querySelector<HTMLElement>("[data-exercise][data-locked]");
if (root) {
  const slug = root.dataset["locked"] ?? "";
  void loadMe().then(async (me) => {
    const text = document.querySelector<HTMLElement>("[data-paywall-text]");
    if (!me) return;
    if (!me.pro) {
      if (text)
        text.textContent =
          "Your plan is Free. Get PRO to open this exercise and every other PRO one.";
      return;
    }
    const res = await fetch(`/api/exercises/${encodeURIComponent(slug)}/`, {
      credentials: "same-origin",
    });
    if (!res.ok) {
      if (text)
        text.textContent = "This exercise could not be opened. Reload the page to try again.";
      return;
    }
    const { answers } = (await res.json()) as { answers: string[] };
    for (const code of root.querySelectorAll<HTMLElement>("[data-answer]")) {
      code.textContent = answers[Number(code.dataset["answer"])] ?? "";
    }
    root.querySelector("[data-paywall]")?.remove();
    delete root.dataset["locked"];
    root.dispatchEvent(new CustomEvent("exercise-unlock", { detail: answers }));
  });
}
