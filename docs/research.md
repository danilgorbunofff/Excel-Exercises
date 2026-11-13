# Phase 1 research

Recorded 10 November 2026. This document separates two kinds of claim:

- **Observed** means I saw it myself on that date, with the method in section 1. Raw data is in `docs/research/`.
- **Reported** means a source says it. Each reported claim names its source and how far I checked it.

Where I could not check something, the text says so.

## Contents

1. Method and limits
2. Comparable products (observed)
3. Learning science (reported)
4. Usability evidence (reported)
5. Accessibility: what WCAG 2.2 adds (reported)
6. Platform support (data)
7. Licences of spreadsheet and formula libraries (observed)
8. Where to win, what to adopt, what to avoid

## 1. Method and limits

I examined each product in two ways.

1. **By hand, in a browser.** I visited each product in Chromium inside the app, at desktop size and at a 375 by 812 phone size. I opened the first exercise, typed wrong answers where the site allowed it, and read the page structure and live regions. I chose the most privacy-preserving option on every consent dialog that offered one, and created no accounts.
2. **By script.** `docs/research/measure.ts` loads every URL cold in headless Chromium. It uses a 375 by 812 phone viewport, Lighthouse's Slow 4G network profile (150 ms round trip, 1.6 Mbps down) and a 4x CPU slowdown. It records:
   - when the exercise became usable
   - every request to another site
   - anything fixed or sticky covering more than 8% of the screen

   It also saves screenshots at 375 and 1280 px in `docs/research/shots/`. The raw results are in `docs/research/measurements.json`. `docs/research/feedback.ts` scripts wrong answers on the two sites whose grids are drawn on a canvas.

Limits:

- Each URL was measured once, from one location, on one day. Timings are indicative, not benchmarks.
- Consent dialogs and trackers can differ by visitor region.
- "Another site" means a different registrable domain, worked out crudely as the last two labels of the host name. A company's own CDN on another domain therefore counts as third party. The host lists show which hosts those are.
- One site (Coddy) served a bot check to the scripted browser. I did not try to get past it, so its numbers come from the manual visit only.
- Some products put exercises behind sign-up. I record that fact and mark their exercise screens as not observed.

## 2. Comparable products (observed)

### 2.1 Measurements on the phone profile

"Usable" means the grid or input could be typed into, judged by what appeared on the page. Where no exercise is on the page, it means the load event.

| Page                             | Usable after                       | Requests | Hosts on other sites                                                                                   | Covering the phone screen after load           |
| -------------------------------- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Excel Exercises, home            | 5.7 s (load)                       | 36       | 15: Google Analytics and Tag Manager, DoubleClick, Facebook, Bing Ads, Microsoft Clarity, Google Fonts | nothing                                        |
| Excel Exercises, first lesson    | 3.7 s (grid)                       | 67       | 21: the above plus Firebase, Firestore, jQuery and unpkg CDNs                                          | nothing                                        |
| Spreadsheet Center, home         | 10.9 s (grid on the page)          | 63       | none                                                                                                   | sticky header (8%)                             |
| Spreadsheet Center, Basic SUM    | grid not drawn within 45 s         | 70       | none                                                                                                   | sticky header (8%)                             |
| Coddy, Excel playground          | not measured: bot check            |          |                                                                                                        |                                                |
| ExcelPractices, home             | 1.7 s (load)                       | 6        | 4: Google Analytics and Tag Manager, Google Fonts                                                      | nothing                                        |
| ExcelPractices, a tutorial       | 1.9 s (load)                       | 7        | 4: same                                                                                                | nothing                                        |
| AutomateExcel, formulas tutorial | 7.7 s (load)                       | 171      | 11: including iubenda consent, Facebook, a push-notification service (PushCrew)                        | not recorded (script error)                    |
| W3Schools, first Excel exercise  | input not usable within 45 s       | 42       | 11: including ad tech (Sparteo, flashb.id) and a consent platform                                      | consent dialog (100%) and answer buttons (10%) |
| Microsoft Support, SUMIF         | 5.3 s (load)                       | 70       | 10: Microsoft domains (sign-in, video, telemetry) and Google Fonts                                     | nothing                                        |
| Exceljet, SUMIF                  | 6.8 s (load)                       | 58       | 7: including the InMobi consent platform and ad header bidding                                         | consent dialog (100%)                          |
| Ablebits, SUMIF                  | 3.1 s (load)                       | 25       | 3: Cookiebot, Tag Manager                                                                              | consent dialog (94%)                           |
| Excel Easy, SUMIF                | 5.8 s (load)                       | 35       | 7: including Google ad syndication                                                                     | consent dialog (100%)                          |
| freeCodeCamp, home               | 13.5 s (load)                      | 47       | 7: Stripe, Google Analytics, Cloudflare Insights                                                       | nothing                                        |
| Exercism, home                   | 5.2 s (load)                       | 106      | 2: Cloudflare Insights                                                                                 | sticky header (8%)                             |
| Exercism, an exercise page       | 4.9 s (load)                       | 147      | 6: Cloudflare Insights, Mux video                                                                      | sticky header (8%)                             |
| Execute Program, home            | 3.1 s (load)                       | 95       | 2: Plausible, Bugsnag                                                                                  | nothing                                        |
| Khan Academy, home               | load event not reached within 45 s | 14       | 2                                                                                                      | nothing recorded                               |
| Brilliant, home                  | 18.5 s (load)                      | 140      | 8: OneTrust, Amplitude, Stripe                                                                         | cookie banner (15%)                            |
| Codecademy, home                 | 12.0 s (load)                      | 78       | 2                                                                                                      | cookie banner (35%)                            |
| Codecademy, Learn Python 3       | 52.1 s (load)                      | 95       | 7: including Google ad syndication, Vimeo                                                              | cookie banner (35%)                            |
| DataCamp, home and a course      | not measured: bot check            |          |                                                                                                        |                                                |
| Duolingo, home                   | 15.9 s (load)                      | 129      | 8: OneTrust, reCAPTCHA Enterprise, Google sign-in                                                      | cookie banner (38%)                            |

### 2.2 Excel practice sites

**Excel Exercises (excelexercises.com).**

- **Layout.** A list of 85 numbered lessons sits on the left. The instruction box is above an Excel-styled grid, built from HTML tables, with a name box and a formula bar. In the phone view the instruction text was cut off at the right edge.
- **Feedback.** A correct answer shows a fixed bottom bar: "Correct! +178 pts" with Continue. The page also holds a hidden "Incorrect" and "Show Correct Answer" alert. Grading checks the value only: I typed `=100+20` where the task asked for `=A1+A2`, and it was marked correct.
- **Progress and order.** One numbered lesson list, used in the sidebar and the lesson pages. There are points, and a leaderboard script.
- **Landing.** A centred headline, one button, a row of topics with check marks, then a strip claiming "250,000+ registered users" and "50+ partner organizations".
- **Load.** The grid was usable at 3.7 s on the phone profile. On my first manual visit "Loading spreadsheet" was still showing after 4 s. A warm reload took 0.4 s.
- **Interruptions.** None on load. A "Skip Question" bar stays fixed at the bottom.
- **Third parties.** 21 hosts on the lesson page, including Facebook, Bing Ads, DoubleClick and Microsoft Clarity, which records sessions. There was no consent dialog in my session.
- **Phone.** The grid works but is narrow, and the lesson list moves above the task.

**Spreadsheet Center (spreadsheetcenter.com).**

- **Layout.** Instructions on the left, with Exercise and Answer tabs, a running timer and hints in accordions. On the right is a grid drawn on `<canvas>`, with a name box and a formula bar. On a phone the grid sits below the full instructions, out of the first screen.
- **Feedback** (scripted, `docs/research/feedback.json`):
  - `=SUM(B2:B6)` is one row short. B9 showed 94,850 and **no message appeared**.
  - Six typed numbers adding to the right total opened the "Exercise completed" dialog. It said **"Nice work! You calculated a total with SUM"**, though the formula used no SUM.
  - The correct formula opened the same dialog. Its only way on is a "Next recommended exercise" button inside the dialog, which covers the grid.
  - No ARIA live region carried any verdict.
- **Progress and order.** The catalogue lists exercises alphabetically ("A/B test results analysis", "Absolute reference practice" and so on). Tracks list them in a different order, so the same exercises appear in at least two orders. Some items are marked PRO.
- **Landing.** A centred headline with two buttons, then a live exercise card on the page itself. Its grid shows grey placeholder blocks before the canvas draws.
- **Load.** The home-page grid drew at 10.9 s on the phone profile. On the exercise page, the phone profile had no grid canvas at all after 45 s. At 1280 px it drew normally.
- **Interruptions.** A "Cookies and browser storage" notice with one "Got it" button covered the lower part of the phone screen, including the exercise card.
- **Third parties.** None. The notice says analytics are cookieless.

**Coddy (coddy.tech/playground/excel).** Observed by hand only; the scripted browser got a Cloudflare bot check.

- **Layout.** The landing page is the exercise: "Exercise 1 of 24", the task, then "Answer cells: B8" and "Functions: SUM". Below are Check, Hint and Show solution, and a canvas grid with Excel-style ribbon tabs. The page also contains one `<table>`, whose role I did not check.
- **Feedback.** It sits in an ARIA live region and names the cell. Pressing Check with nothing typed gave: "Not quite. Nothing is in the answer cells yet (B8). Click one and type a formula that starts with =." The page says it explains misspelled functions, empty lookups and references that move. I could not type into the canvas grid in my session, so I did not see those verdicts.
- **Progress and order.** "0/24" with previous and next arrows. One order.
- **Interruptions.** A cookie banner saying the cookies "measure our ads", with Accept all and Reject non-essential.

**ExcelPractices (excelpractices.pages.dev).**

- **Layout.** Mostly keyboard shortcuts. The tutorial grid is an HTML `<table>` with cells labelled "You are here" and "Move here", "Step 1 / 4", and Show Answer and Skip.
- **Order.** The tutorials page numbers its items 1, 2, 6, 3, 8, 4, 7, 5 in reading order.
- **Landing.** A centred headline under an eyebrow line, "100+ free exercises · 6 categories", then mode cards including a 60-second speed run and a leaderboard.
- **Load.** 1.7 to 1.9 s.
- **Third parties.** Google Analytics, Tag Manager and Google Fonts.
- **Phone.** The top navigation runs off the right edge.

**AutomateExcel (automateexcel.com/formulas-functions).**

- An interactive formula tutorial. It says creating an account saves progress, and the sign-in links go only to Google.
- 171 requests, including a push-notification service.
- I did not complete an exercise, so feedback is not observed.

**W3Schools (Excel exercises).**

- Fill-in-the-blank exercises with "Completed 0 of 49 Exercises", and Submit Answer and Show Answer buttons fixed at the bottom.
- On a phone a consent dialog covered the whole screen. It named 1,753 partners. The input stayed unusable until a choice was made.

### 2.3 Excel reference sites (SUMIF)

| Site              | What I saw                                                                                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Microsoft Support | No dialog. The URL redirects to `/en-us/excel/functions/sumif-function`. An "Applies To" disclosure, a paragraph with an inline formula, a static screenshot of Excel and an embedded video. Hidden requests to Microsoft sign-in hosts. No exercise. |
| Exceljet          | On a phone, a consent dialog covers the page (1,752 partners), with Agree first and Disagree last. Breadcrumbs, a hamburger menu on phones, a diagram of the function's arguments. No exercise in what I saw.                                         |
| Ablebits          | A Cookiebot dialog covers 94% of a phone screen. "Allow all" is the filled button and "Deny" is last. Long article with formula examples.                                                                                                             |
| Excel Easy        | The consent dialog's first layer offers only "Consent" and "Manage options", with no plain refusal. Header tagline "#1 Excel tutorial on the net". A grid picture, which I did not check for interactivity.                                           |

None of the four ended in a live exercise. Every one but Microsoft's covered the page with a consent dialog on a phone.

### 2.4 Interactive learning products

| Product         | Exercise without an account                                             | Exercise layout and feedback                                                                                                                                                                       | Order and progress                                                              | Landing                                                                                                          |
| --------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| freeCodeCamp    | Yes: the daily challenge loads in the browser.                          | Instructions, then a numbered list of tests, each with a status ("Waiting") before you start, then the editor and a console. The learner sees exactly what will be checked. I did not submit code. | Certification curricula plus a daily challenge.                                 | A huge headline, one paragraph, one "Get started (it's free)" button. Stripe's script loads on the landing page. |
| Exercism        | The exercise page loads. I did not try solving.                         | Not observed.                                                                                                                                                                                      | Tracks per language.                                                            | Headline, "Sign up for free" and "Explore languages", an illustration.                                           |
| Execute Program | A sample lesson runs on the landing page ("Try it yourself", Continue). | Reported by the page: explanation, then you write and run code, then later short reviews.                                                                                                          | "Each course is a graph of lessons." Spaced reviews are reported, not observed. | Sample lesson, testimonials and a usage statistic. Only Plausible and Bugsnag as third parties.                  |
| Khan Academy    | Yes: guest practice with an answer box, Check and Skip.                 | My wrong answer gave no visible verdict in my session; a cookie dialog was still open. Not observed.                                                                                               | Course, unit and lesson breadcrumbs.                                            | Not recorded: the load event did not fire within 45 s.                                                           |
| Brilliant       | Not checked.                                                            | Not observed.                                                                                                                                                                                      |                                                                                 | Cookie banner over 15% of the phone screen. 18.5 s load.                                                         |
| Codecademy      | Course pages lead to sign-up.                                           | Not observed.                                                                                                                                                                                      |                                                                                 | Cookie banner over 35% of the screen. The course page took 52 s on the phone profile.                            |
| DataCamp        | Not measured: bot check.                                                |                                                                                                                                                                                                    |                                                                                 |                                                                                                                  |
| Duolingo        | Not checked.                                                            | Not observed.                                                                                                                                                                                      |                                                                                 | Cookie banner over 38% of the screen. reCAPTCHA Enterprise loads on the landing page.                            |

The learning products are where the strongest practice patterns are reported: tests listed before the attempt, sample lessons on the landing page, and spaced review. For several I could not observe the exercise loop without an account, which is itself the pattern this brief rules out.

## 3. Learning science (reported)

Strength ratings are mine. **Strong** means several meta-analyses agree and the effect holds in classrooms. **Moderate** means one meta-analysis or real conditions on when it works. **Weak** means small, unstable or indirect evidence.

For most papers I read the abstract and summaries, not the full text. Numbers taken only from a secondary source are marked.

### 3.1 Retrieval practice: strong

- Adesope, Trevisan and Sundararajan (2017), _Review of Educational Research_ 87(3), 659-701, [doi:10.3102/0034654316689306](https://doi.org/10.3102/0034654316689306).
  - Practice tests beat restudying and every other comparison condition.
  - The benefit held at all retention intervals. It was largest when the final test came 1 to 6 days later.
  - Feedback on the practice test raised the effect slightly, but the difference was not significant.
- Rowland (2014), _Psychological Bulletin_ 140(6), 1432-1463, [doi:10.1037/a0037559](https://doi.org/10.1037/a0037559).
  - A citing review reports an overall g of 0.50.
  - A thesis summarising it reports two more findings: the effect grows with initial success, and it disappears when initial performance is below 50%.
  - I did not read the paper, so these figures are secondary.

**For this design:** an exercise is retrieval practice, so the core loop is well founded. Rowland's finding on initial success argues for a gentle first exercise in each topic, and for a hint ladder that keeps learners succeeding without handing over the answer.

### 3.2 Spacing: strong for recall, less direct for procedures

- Cepeda, Pashler, Vul, Wixted and Rohrer (2006), _Psychological Bulletin_ 132(3), 354-380, [doi:10.1037/0033-2909.132.3.354](https://doi.org/10.1037/0033-2909.132.3.354).
  - The review covers 839 assessments in 317 experiments.
  - Spaced study beats massed study.
  - The best gap between sessions grows with how long the learner must remember.
- The studies are mostly verbal recall. Writing a formula is a procedural skill, so the evidence transfers, but less directly.

**For this design:** a "due for review" list on the progress page, with gaps that grow after each correct review. Nothing needs a streak or a daily target.

### 3.3 Interleaving: moderate and conditional

- Brunmair and Richter (2019), _Psychological Bulletin_ 145(11), 1029-1052, [doi:10.1037/bul0000209](https://doi.org/10.1037/bul0000209).
  - Overall g = 0.42 across 59 studies.
  - Effects are larger when categories look alike across groups and vary within a group, and for complex material.
  - Mathematical tasks show a small effect. Word learning shows a negative one.

**For this design:** introduce each function in its own topic first. Then interleave functions that are easy to confuse in review sets: SUMIF against COUNTIF, COUNT against COUNTA, VLOOKUP against XLOOKUP. Do not interleave on first exposure.

### 3.4 Feedback type and timing: strong on type, moderate on timing

- Wisniewski, Zierer and Hattie (2020), _Frontiers in Psychology_ 10:3087, [doi:10.3389/fpsyg.2019.03087](https://doi.org/10.3389/fpsyg.2019.03087).
  - Overall d = 0.48, with large differences between studies.
  - How much information the feedback carries strongly changes its effect.
- Van der Kleij, Feskens and Eggen (2015), _Review of Educational Research_ 85(4), 475-511, [doi:10.3102/0034654314564881](https://doi.org/10.3102/0034654314564881). It looks at computer-based learning only.
  - Explanatory feedback: 0.49.
  - Showing the correct answer: 0.32.
  - Saying only right or wrong: 0.05.
  - Immediate feedback helped more for lower-order outcomes, but the interaction with timing was not significant.

**For this design:** a bare "Incorrect" is the weakest kind of feedback measured. The verdict must say which rule failed, where, and what the formula actually read. Grading on Enter gives immediate feedback, which suits a lower-order skill like formula syntax.

### 3.5 Worked examples: strong for novices, reverses with expertise

- Barbieri, Miller-Cotto, Clerjuste and Chawla (2023), _Educational Psychology Review_ 35:11, [doi:10.1007/s10648-023-09745-1](https://doi.org/10.1007/s10648-023-09745-1).
  - Mathematics, g = 0.48.
  - Examples that show only correct work had larger effects than sets mixing correct and incorrect work.
  - Reports differ on the number of studies.
- Kalyuga (2007), _Educational Psychology Review_ 19(4), 509-539, [doi:10.1007/s10648-007-9054-3](https://doi.org/10.1007/s10648-007-9054-3). The expertise reversal effect: methods that help novices can hinder learners who already know the material.

**For this design:** every function reference page gets one correct worked example. The exercise screen puts the task first and the example behind a hint or the notes, so a learner preparing for a job test is not slowed down. "Common errors" stays a short list, not a set of worked wrong examples.

### 3.6 Streaks and gamification: weak for learning, real for engagement

- Sailer and Homner (2020), _Educational Psychology Review_ 32(1), 77-112, [doi:10.1007/s10648-019-09498-w](https://doi.org/10.1007/s10648-019-09498-w).
  - Gamification had small positive effects: cognitive g = 0.49, motivational g = 0.36, behavioural g = 0.25.
  - Only the cognitive effect held in the more rigorous studies.
  - Which game elements cause the effect is unclear.
- Silverman and Barasch (2023), _Journal of Consumer Research_ 49(6), 1095-1117, [doi:10.1093/jcr/ucac029](https://doi.org/10.1093/jcr/ucac029).
  - Across seven studies, an intact streak raised engagement because keeping the streak became a goal in itself.
  - A broken streak lowered engagement.
  - A university summary quotes the authors: language-app users whose streak broke tended to switch language rather than start again.
  - The outcome measured is engagement, not learning.

**For this design:** the brief's ban on streaks and countdowns is consistent with the evidence. Streaks drive return visits through the streak itself, and a break pushes people away. We measure retries to a correct answer, not days in a row.

## 4. Usability evidence (reported)

- **Hidden navigation.** NN/g, [Hamburger Menus and Hidden Navigation Hurt UX Metrics](https://www.nngroup.com/articles/hamburger-menus/) (2016). It is a single study of six sites.
  - On desktop, people used hidden navigation in 27% of cases, against 48% for visible and 50% for combo navigation.
  - Reaching it took longer: 31 s, against 23 to 26 s.
  - On desktop some people never saw the menu icon.
  - **For this design:** visible links on desktop, with a menu button only on phones, as the brief already says.
- **Error messages.** NN/g, [Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/) and [the scoring rubric](https://www.nngroup.com/articles/error-messages-scoring-rubric/). I read search excerpts, not the full pages.
  - Show the message next to the problem, with redundant and accessible indicators.
  - Say how to fix it, at low effort.
  - Do not show it before the error has happened.
  - **For this design:** the verdict sits beside the formula input. It names the cell, the reference and the fix. It appears only after Enter, never while typing.
- **Progress indicators.** NN/g, [Progress Indicators Make a Slow System Less Insufferable](https://www.nngroup.com/articles/progress-indicators/) (2014).
  - Give feedback for anything over about 1 s.
  - Use a looping indicator for 2 to 10 s and a percent-done indicator beyond 10 s.
  - The article cites Nah (2004): people waited about three times longer when shown a looping indicator.
  - **For this design:** grading is local and should finish well under 100 ms, so no indicator is needed. Nothing loads behind a skeleton. Course progress is a different matter: the progress page shows a plain count against the single track order.

## 5. Accessibility: what WCAG 2.2 adds (reported)

Source: W3C, [What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/). WCAG 2.2 adds nine success criteria and removes 4.1.1 Parsing as obsolete.

| Criterion                                  | Level | What it constrains here                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.4.11 Focus Not Obscured (Minimum)        | AA    | Nothing the author places, such as a sticky header or verdict bar, may fully hide the focused element. On a phone the on-screen keyboard shrinks the viewport, so the safest plan is no sticky elements on the exercise screen. Any sticky element gets matching `scroll-padding`.                                                |
| 2.4.12 Focus Not Obscured (Enhanced)       | AAA   | Same, with no part of the focused element hidden. A useful target even though it is not required.                                                                                                                                                                                                                                 |
| 2.4.13 Focus Appearance                    | AAA   | Focus indicator size and contrast. The tokens will meet it anyway: a 2 px ring at 3:1 or better.                                                                                                                                                                                                                                  |
| 2.5.7 Dragging Movements                   | AA    | If ranges can ever be picked by dragging across cells, typing the reference must remain a full alternative. The plan already uses typing only.                                                                                                                                                                                    |
| 2.5.8 Target Size (Minimum)                | AA    | Pointer targets of at least 24 by 24 CSS px, or spaced so a 24 px circle around each does not overlap another. Exceptions cover inline links in text and equivalent controls. Grid cells are not targets in this design, which avoids tiny tap targets on a phone. Primary controls will be 44 px tall.                           |
| 3.2.6 Consistent Help                      | A     | Contact details, if shown on several pages, stay in the same relative order. The footer contact link goes in one fixed place.                                                                                                                                                                                                     |
| 3.3.7 Redundant Entry                      | A     | Information already entered in a process is filled in again or selectable. For the exercise, a wrong formula stays in the input after Check, so the learner edits it rather than retyping.                                                                                                                                        |
| 3.3.8 Accessible Authentication (Minimum)  | AA    | No memory or puzzle test to sign in, unless there is an alternative, help such as paste or a password manager, or an object or personal-content test. W3C's examples name password managers and copy and paste. Sign-in by email link fits the "alternative method" route, though the page does not rule on email links directly. |
| 3.3.9 Accessible Authentication (Enhanced) | AAA   | No object or personal-content exceptions. An email link also meets this.                                                                                                                                                                                                                                                          |

One more point, observed in section 2: two of the practice sites draw their grid on `<canvas>`. A canvas has no cells, rows or headers for assistive technology unless the site adds a parallel structure. A server-rendered `<table>` with `<th scope>` headers avoids the problem entirely.

## 6. Platform support (data)

Source: the `web-features` dataset, version 3.45.0, published 10 November 2026 (Apache-2.0). It powers MDN's Baseline labels.

- **Widely available** means Baseline for 30 months.
- **Newly available** means supported in the current Chrome, Edge, Firefox and Safari.
- **Not Baseline** means at least one of those engines lacks it.

| Feature                                                    | Status                            | First versions with support                                                                                                                                                                      | Use in this design                                                                                                                                        |
| ---------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<dialog>`                                                 | Widely available since 2024-09-14 | Chrome 37, Firefox 98, Safari 15.4                                                                                                                                                               | Phone menu, as the brief asks.                                                                                                                            |
| Popover (`popover` attribute, `showPopover()`)             | Widely available                  | Chrome 114, Firefox 125, Safari 17                                                                                                                                                               | Optional, for a non-modal hint panel. The whole "popover" feature is only newly available (2025-01-27), because of later sub-features.                    |
| `<dialog closedby>`                                        | Not Baseline                      | Chrome 134, Firefox 141, no Safari                                                                                                                                                               | Do not rely on it.                                                                                                                                        |
| CSS anchor positioning                                     | Not Baseline                      | Core parts (`anchor-name`, `anchor()`, `position-area`, `position-try-fallbacks`): Chrome 125 to 129, Firefox 147, Safari 26. The `position-anchor` property: Chrome and Firefox 151, Safari 27. | Nothing essential. The verdict sits in normal flow next to the input, which needs no anchoring.                                                           |
| View transitions, same document                            | Newly available since 2025-10-14  | Chrome 111, Firefox 144, Safari 18                                                                                                                                                               | Not needed. If used, only as an enhancement inside the reduced-motion guard, at 180 ms or less.                                                           |
| View transitions, cross document                           | Not Baseline                      | Chrome 126, Safari 18.2, no Firefox                                                                                                                                                              | Not needed.                                                                                                                                               |
| Speculation Rules                                          | Not Baseline                      | Chromium only (Chrome 109)                                                                                                                                                                       | Optional: prefetch the "Next" exercise in Chromium. It is same-origin, so it adds no third-party request. Other browsers ignore it.                       |
| `light-dark()`                                             | Newly available since 2024-05-13  | Chrome 123, Firefox 120, Safari 17.5                                                                                                                                                             | Already used for tokens. By the 30-month rule it becomes widely available on 2026-11-13.                                                                  |
| Container size queries                                     | Widely available since 2025-08-14 | Chrome 105, Firefox 110, Safari 16                                                                                                                                                               | Use for the exercise layout, so the grid and verdict adapt to their column, not the window.                                                               |
| CSS Custom Highlight API                                   | Newly available since 2026-03-24  | Chrome 105, Firefox 149, Safari 17.2 (Highlight objects since Firefox 140)                                                                                                                       | See the limit below.                                                                                                                                      |
| `font-size-adjust`                                         | Newly available since 2024-07-25  | Chrome 127, Firefox 118, Safari 17                                                                                                                                                               | Optional extra for fallback fonts.                                                                                                                        |
| `@font-face size-adjust`                                   | Widely available                  | Chrome 92, Firefox 92, Safari 17                                                                                                                                                                 | Fallback font tuning.                                                                                                                                     |
| `ascent-override`, `descent-override`, `line-gap-override` | Not Baseline                      | Chrome 87, Firefox 89, no Safari                                                                                                                                                                 | Safari ignores them, so fallback metrics can only be fully matched in Chrome and Firefox. Phase 5 must measure layout shift in WebKit, not just Chromium. |

**The Custom Highlight API cannot colour text inside `<input>` or `<textarea>`.** This is my reading, not something MDN states. The API styles DOM `Range` objects, and the text of a form control is not in the document tree, so no range can point at it. MDN lists the properties `::highlight()` can set: `color`, `background-color`, `text-decoration`, `text-shadow` and the `-webkit-text-stroke` and `-webkit-text-fill` colours. It is silent on form controls.

The consequence: to colour references in the formula itself, the colouring must happen in a rendered copy of the formula, such as an echo of it in the verdict. It cannot happen inside the input. Phase 5 will confirm this with a test in all three engines before relying on it.

## 7. Licences of spreadsheet and formula libraries (observed)

Licence and version data comes from the npm registry, checked on 10 November 2026. The Handsontable and HyperFormula terms come from their own docs and README. The Luckysheet status comes from its GitHub page.

| Package              | Version       | Licence                                          | Last published              | Notes                                                                                                                                                                                                |
| -------------------- | ------------- | ------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hyperformula         | 3.5.0         | GPL-3.0-only, or a paid proprietary licence      | 2026-10                     | GPL code shipped to browsers puts the bundle under GPL terms. Unsuitable unless the owner buys a licence.                                                                                            |
| handsontable         | 18.1.2        | Proprietary                                      | 2026-11                     | The free key `non-commercial-and-evaluation` covers only use "not intended toward monetary compensation". A missing or invalid key shows a blocking modal over the grid. Unsuitable for a paid site. |
| @formulajs/formulajs | 4.6.1         | MIT                                              | 2026-07                     | Function implementations without a parser. Useful to cross-check semantics, not as the grader.                                                                                                       |
| fast-formula-parser  | 1.0.19        | MIT                                              | 2023-10                     | Parser and evaluator. Unmaintained for three years.                                                                                                                                                  |
| hot-formula-parser   | 4.0.0         | MIT                                              | 2022-06                     | Handsontable's older parser. Unmaintained.                                                                                                                                                           |
| excel-formula        | 1.5.0         | MIT                                              | 2022-06                     | Tokenizer and formatter only.                                                                                                                                                                        |
| xlsx (SheetJS)       | 0.18.5 on npm | Apache-2.0                                       | 2026-07 (registry metadata) | Reads and writes files. Does not evaluate formulas.                                                                                                                                                  |
| exceljs              | 4.4.0         | MIT                                              | 2024-12                     | Reads and writes files. Does not evaluate formulas.                                                                                                                                                  |
| jspreadsheet-ce      | 5.0.4         | MIT (per README; the npm licence field is empty) | 2025-08                     | A grid UI.                                                                                                                                                                                           |
| jspreadsheet         | 13.1.0        | npm licence field empty                          | 2026-11                     | The commercial edition. I did not check its terms.                                                                                                                                                   |
| x-data-spreadsheet   | 1.1.9         | MIT                                              | 2022-05                     | A grid UI. Unmaintained.                                                                                                                                                                             |
| @univerjs/core       | 1.4.0         | Apache-2.0                                       | 2026-11                     | A full spreadsheet suite. Far beyond the 70 kB budget for a single exercise, though I did not measure its size.                                                                                      |
| @fortune-sheet/core  | 1.0.4         | MIT                                              | 2025-11                     | A grid UI.                                                                                                                                                                                           |
| luckysheet           | 2.1.13        | MIT                                              | 2022-05                     | Archived on GitHub on 2025-10-30. Its README points to Univer.                                                                                                                                       |

**Conclusion:** none of these is needed. The grid is a server-rendered `<table>`, and the grader is a small purpose-built package (decided in Phase 0). The permissive parsers are either unmaintained or carry far more than the content needs. The two most capable options, HyperFormula and Handsontable, are GPL or proprietary.

## 8. Where to win, what to adopt, what to avoid

### Where to win: what no product I saw does well

1. **Grading the method, not only the value.** Both practice sites where I got a verdict accepted typed numbers as correct. Spreadsheet Center praised a formula with no SUM for using SUM. A grader that checks the required function and real references first, as Phase 3 plans, is the clearest point of difference.
2. **Saying something specific when the answer is wrong.**
   - Spreadsheet Center was silent on a range one row short.
   - Excel Exercises has only "Incorrect" and "Show Correct Answer" in its markup.
   - Coddy was the only product that named the cell in its verdict.
   - None of the products I saw showed on the grid which cells a wrong formula read.
   - Feedback research (section 3.4) puts right-or-wrong feedback at almost no effect and explanatory feedback at about 0.5.
3. **A grid that is real HTML on first paint.**
   - Excel Exercises builds its table grid with script after load, showing "Loading spreadsheet" first.
   - Spreadsheet Center and Coddy draw on `<canvas>`.
   - On the phone profile the fastest grid was usable at 3.7 s, and Spreadsheet Center's exercise grid did not draw within 45 s.
   - A server-rendered `<table>` should be usable as soon as the HTML arrives.
4. **Private and fast together.** Spreadsheet Center was the only practice site with no third-party requests, and it was also the slowest to a usable grid. Every reference site set ad or consent technology before the content. A site with no tracking needs no consent dialog, so the first phone screen can be the exercise.
5. **Reference pages that end in practice.** None of the four SUMIF pages let the reader try the function. They rank for function names, and the brief's reference pages end in a live exercise.
6. **One order.**
   - Spreadsheet Center has an alphabetical catalogue and separately ordered tracks.
   - ExcelPractices numbers its tutorials out of sequence on the page.
   - Excel Exercises is the counter-example: one numbered list everywhere. It shows this is easy to get right.

### What to adopt

- **From Coddy:**
  - The landing page is the first exercise.
  - The answer cell and required functions are listed above the grid.
  - The verdict goes in a live region and names the cell.
  - Hint and show-solution controls sit next to Check.
- **From freeCodeCamp:** list what will be checked before the attempt. For us that is a short line such as "Checks: uses SUM, refers to cells, gives the total". Each verdict then matches one item the learner has already read.
- **From Excel Exercises:** a single numbered lesson list, and a name box plus formula bar that do their real job.
- **From Execute Program:** a working sample on the landing page, and short spaced reviews of earlier material (section 3.2). It is also proof that a commercial learning site can run with only privacy-respecting analytics.
- **From Spreadsheet Center:** no third-party requests at all.
- **From Microsoft Support:**
  - Open the page without interruption.
  - State which Excel versions a function applies to.
  - The brief's "checked against" date extends this.
- **From Khan Academy:** practice works as a guest.

### What to avoid

- **Value-only grading,** and success messages that claim something the grader did not check.
- **Silence on a wrong answer.** Every miss gets a verdict that names a rule and a cell.
- **A success dialog over the grid** that holds the only way forward. The brief's in-place change from Check to Next is better.
- **Timers on exercises, points, leaderboards and 60-second speed runs.** The evidence in section 3.6 is for engagement, not learning, and a visible timer adds pressure for an adult learner in a short sitting.
- **Canvas grids,** grids below the first phone screen, and grey placeholder blocks before the grid draws.
- **Consent dialogs, ad tech, session recording, push notifications** and sign-in only through Google.
- **The same exercises in two orders,** or numbers out of sequence.
- **Usage claims and testimonials** in place of the product working. The brief's ban already covers these.
- **Bot checks on public pages.** Cloudflare checks stopped scripted visits to Coddy and DataCamp. A host's bot protection should stay off for static content, both for automated accessibility testing and to avoid the challenge's third-party requests.

### Effects on later phases

- **Phase 3 (grader).** Rule order as in the brief: syntax, required function, forbidden function, references, value. The observed failures are exactly the cases rules 2 and 4 catch.
- **Phase 0 decision 9 (hint depth) stands.** On-grid display of what the learner's formula read is automatic. The comparison with the reference answer is hint step 2. The feedback research supports showing the learner's own data right away.
- **Phase 5 (exercise screen):**
  - No sticky elements, to meet 2.4.11 even with the phone keyboard open.
  - A wrong formula stays in the input, to meet 3.3.7.
  - Colour references in an echo of the formula, not inside the input (section 6).
  - Measure layout shift from the font swap in WebKit, because Safari ignores `ascent-override` and related properties.
- **Phase 6 (pages).** Every function reference page ends in a live exercise. The landing page opens with one, with no dialog in front of it.
