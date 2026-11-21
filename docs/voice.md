# Voice and copy guide

Every word a visitor can read follows this page. `npm run lint:copy` enforces the mechanical rules. The rest needs an editor.

## Reader

An adult learning Excel for work or for an assessment. They have little time, they may be nervous about a test, and they want to know what to do next.

## Voice

A calm, exact tutor sitting next to the reader.

- Write to "you". Use the active voice and the present tense.
- Give instructions as imperatives: "Type the formula in B6."
- Say the specific thing. "128 exercises" beats "lots of exercises". "Returns `#N/A`" beats "fails".
- Praise is a fact, not a cheer: "Solved." not "Great job".
- Never blame the reader. Describe the formula, not the person.

## Mechanics

- **Spelling:** UK English. Practise is the verb and practice is the noun. Use -ise (summarise), colour, behaviour, catalogue, centre, licence (noun).
- **Excel behaviour:** Microsoft 365 Excel, en-US. Comma argument separators and decimal points.
- **Functions:** in capitals (VLOOKUP, XLOOKUP). Cell references as `B6` and ranges as `A2:A20`. Put whole formulas in backticks: `=SUM(B2:B9)`.
- **Interface:** name menus and buttons exactly as Excel shows them, with a `>` between steps: Home > Conditional Formatting.
- **Numbers:** digits for counts and money: `$1,200`, 3 hints. Dates are written day first: 16/11/2026.
- **Characters:** no em or en dashes, curly quotes, `…`, emoji or exclamation marks.
- **Length:** sentences of 29 words or fewer, paragraphs of 69 or fewer.

## Signs of machine writing

These patterns make text read as generated filler. They come from Wikipedia's "Signs of AI writing" field guide and from editors who clean up AI prose. Treat them as warnings to check, not words to swap for synonyms. Fixing a tell means rewriting the thought, not dressing it up.

**Vocabulary.** delve, crucial, pivotal, seamless, empower, elevate, harness, landscape, realm, tapestry, testament, vibrant, comprehensive, powerful, effortless, game-changer, streamline, foster, showcase, "in today's...", "whether you're...", "take it to the next level". These words have plain alternatives, or the sentence works without them.

**Structure:**
- Lists of three by reflex, where the third item is vague.
- "It's not X, it's Y" and "not just X, but Y".
- Openers that announce: "In this article", "Let's look at", "Imagine".
- Closers that repeat: "In short", "Ultimately", "The bottom line".
- Every sentence the same length and shape.
- Every bullet starting with a bold label and a colon.
- Rhetorical questions the text then answers.
- A summary sentence at the end of each section.

**Filler and hedges:** simply, basically, actually, really, easily, "it's important to note", "note that", "in order to", "a variety of", "when it comes to". Cut them, then read the sentence again.

**Inflation:** "plays a vital role", "serves as", "stands as", superlatives, and any claim with no number or example behind it.

## Editing method

1. Delete first. Most weak copy is extra words.
2. Name the concrete thing: the cell, the function, the result, the count.
3. One idea per sentence.
4. Vary sentence length. Short sentences land the point. Longer ones carry the reasoning.
5. Read it aloud. Rewrite anything you would not say to the person next to you.
6. Ask whether an Excel trainer with 20 years' experience would write this sentence. If not, rewrite it.

## By surface

- **Prompt:** the task, the cell, the expected result. Nothing the reader cannot act on.
- **Nudge:** points at the idea without naming the answer.
- **Rule:** states the method in one or two sentences.
- **Miss message:** what is wrong and where, then what to look at. Never "wrong" on its own.
- **Error message:** what happened, then the next step.
- **Button:** a verb and an object: "Check formula", "Start track".
- **Article:** the answer in the first paragraph, then the detail.
- **Legal pages:** clarity edits only. Never change what a clause means.

## Correctness

- Every claim about Excel must match Microsoft's documentation or the grader's behaviour. If you cannot confirm it, do not publish it.
- Prompts, hints and miss messages must agree with the sheet, the cell references and the accepted answers.
- Counts, prices and plan names on the site must match the code that produces them.
