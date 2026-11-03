/**
 * THE ACADEMY'S COURSE 1 IS THE SIGNED PROTOCOLS' OWN WORDS, AND COURSE 2 IS A
 * PLACEHOLDER. Robert's ruling P3 of 2026-11-01: "Draft course 1 from each
 * signed protocol's own text, marked 'Awaiting engineer approval' ... Course 2
 * (ladder and roof fall safety) is a placeholder marked 'Awaiting Robert' ...
 * No video and no generated person."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-academy-teaches-the-protocols-own-words.mjs
 *
 * What it asserts, against the transcriptions rather than against a second
 * copy of the course:
 *   - every protocol the portal offers for signing, and 254-RC-001, has exactly
 *     one lesson, and each lesson names the version its transcription carries;
 *   - every line of every reading occurs, as a whole line, in that protocol's
 *     transcription (or, for 254-RC-001, its photo procedure), in order;
 *   - every quiz question's source sentence occurs word for word in its own
 *     lesson's reading, whitespace aside, and its answer is one of its choices;
 *   - no reading names a person or the banned trading name;
 *   - course 2, drafted from OSHA 29 CFR 1926 Subparts X and M on 2026-11-02,
 *     reads "Awaiting Robert", is approved by the owner only, graduates
 *     nobody without his approval, and cites a Subpart X or M section and
 *     paragraph on every line of every reading;
 *   - both courses are required, and nothing in either is a video.
 *
 * NO DATABASE, NO SERVER, NO CREDENTIAL.
 */

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { ACADEMY_COURSES, REQUIRED_COURSES } = await import("../../src/content/academy/courses.ts");
const { SIGNABLE_PROTOCOLS } = await import("../../src/content/protocols/signable.ts");
const { RC001 } = await import("../../src/content/protocols/rc-001.ts");

const norm = (s) => s.replace(/\s+/g, " ").trim();
const course1 = ACADEMY_COURSES.find((c) => c.slug === "duties-and-protocols");
const course2 = ACADEMY_COURSES.find((c) => c.slug === "ladder-and-roof-fall-safety");
check("both courses exist", Boolean(course1 && course2));
check("both, and only both, are required", JSON.stringify([...REQUIRED_COURSES].sort()) === JSON.stringify(["duties-and-protocols", "ladder-and-roof-fall-safety"]));
check("the protocol course is approved by the engineer of record, the safety course by the owner", course1?.approver === "engineer_of_record" && course2?.approver === "owner");

const expected = [...SIGNABLE_PROTOCOLS.map((p) => p.documentNumber), RC001.documentNumber].sort();
const taught = (course1?.lessons ?? []).map((l) => l.teaches.documentNumber).sort();
check("course 1 has one lesson for every signable protocol and 254-RC-001", JSON.stringify(taught) === JSON.stringify(expected), taught.join(", "));
check("and the lesson keys are the document numbers, unique", new Set((course1?.lessons ?? []).map((l) => l.key)).size === (course1?.lessons ?? []).length && (course1?.lessons ?? []).every((l) => l.key === l.teaches.documentNumber));

for (const lesson of course1?.lessons ?? []) {
  const doc = lesson.teaches.documentNumber;
  const source = doc === RC001.documentNumber ? RC001.photoProcedure.map((s) => `${s.step}. ${s.text}`) : SIGNABLE_PROTOCOLS.find((p) => p.documentNumber === doc)?.text ?? [];
  const version = doc === RC001.documentNumber ? RC001.version : SIGNABLE_PROTOCOLS.find((p) => p.documentNumber === doc)?.version;
  check(`${doc}: the lesson names the version the transcription carries`, lesson.teaches.version === version, `${lesson.teaches.version} against ${version}`);
  check(`${doc}: the reading is not empty`, lesson.lines.length >= 3, `${lesson.lines.length} lines`);
  let at = -1;
  const inOrder = lesson.lines.every((line) => {
    const i = source.indexOf(line, at + 1);
    const ok = i > at;
    at = i;
    return ok;
  });
  check(`${doc}: every line of the reading is a whole line of the protocol, in its order`, inOrder);
  const reading = norm(lesson.lines.join(" "));
  check(`${doc}: no line names a person or the banned trading name`, !/Aman|Dhakal|Reyna|254 Engineering Services/i.test(reading));
  check(`${doc}: the quiz has questions`, lesson.quiz.length >= 3, `${lesson.quiz.length}`);
  for (const [n, q] of lesson.quiz.entries()) {
    check(`${doc} question ${n + 1}: its source is the protocol's own sentence, in this reading`, reading.includes(norm(q.source)), q.source.slice(0, 60));
    check(`${doc} question ${n + 1}: its answer is one of its choices, and the choices differ`, Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length && new Set(q.choices).size === q.choices.length);
  }
}

/*
 * COURSE 2, drafted from OSHA 29 CFR 1926 Subparts X and M (Robert,
 * 2026-11-02). Its readings cannot be compared to a transcription in this
 * repository, so the proof holds the shape that makes the comparison possible
 * by hand: every line carries the section and paragraph it quotes, every
 * section is in Subpart X (1926.1050 to 1926.1060) or Subpart M (1926.500 to
 * 1926.503), and every question is drawn from its own lesson's reading. The
 * words were checked against the eCFR text on 2026-11-02 before commit.
 */
const { OSHA_SOURCES } = await import("../../src/content/academy/courses.ts");
const { courseStanding, approvalRefusal, graduation, COURSE_STATUS_LABEL } = await import("../../src/lib/academy.ts");
const CITE = /^1926\.(\d+)\((?:[a-z0-9]+)\)(?:\([a-z0-9]+\))* \S/;
const inScope = (n) => (n >= 1050 && n <= 1060) || (n >= 500 && n <= 503);
check("course 2 is written: no placeholder, and it has lessons", course2?.placeholder === null && (course2?.lessons ?? []).length >= 3, `${(course2?.lessons ?? []).length} lessons`);
check("its standing with no approval reads Awaiting Robert", course2 && COURSE_STATUS_LABEL[courseStanding(course2, []).status] === "Awaiting Robert");
check("only the owner may approve it, never the engineer of record", course2 && approvalRefusal(course2, [], "engineer_of_record") !== null && approvalRefusal(course2, [], "owner") === null);
check("and with no approval of it, nobody graduates", graduation([], []).graduated === false && graduation([], []).courses.find((c) => c.slug === course2?.slug)?.status === "awaiting_robert");
for (const lesson of course2?.lessons ?? []) {
  check(`${lesson.key}: it teaches a subpart this ruling names, at the version its source records`, lesson.teaches.documentNumber in OSHA_SOURCES && OSHA_SOURCES[lesson.teaches.documentNumber] === lesson.teaches.version, `${lesson.teaches.documentNumber} ${lesson.teaches.version}`);
  const cites = lesson.lines.map((l) => l.match(CITE));
  check(`${lesson.key}: every line cites a section and paragraph`, lesson.lines.length >= 3 && cites.every(Boolean), `${lesson.lines.length} lines`);
  check(`${lesson.key}: every cited section is in Subpart X or Subpart M`, cites.every((m) => m && inScope(Number(m[1]))), cites.map((m) => m?.[1]).join(","));
  const reading = norm(lesson.lines.join(" "));
  check(`${lesson.key}: no line names a person or the banned trading name`, !/Aman|Dhakal|Reyna|254 Engineering Services/i.test(reading));
  check(`${lesson.key}: the quiz has questions`, lesson.quiz.length >= 3, `${lesson.quiz.length}`);
  for (const [n, q] of lesson.quiz.entries()) {
    check(`${lesson.key} question ${n + 1}: its source is in this reading`, reading.includes(norm(q.source)), q.source.slice(0, 60));
    check(`${lesson.key} question ${n + 1}: its answer is one of its choices, and the choices differ`, Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length && new Set(q.choices).size === q.choices.length);
  }
}
const everything = JSON.stringify(ACADEMY_COURSES);
check("nothing in either course is a video or an image", !/\.(mp4|mov|webm|png|jpe?g|gif)\b|youtube|vimeo|<video/i.test(everything));

console.log(wrong === 0 ? "PASS: course 1 is the signed protocols' own words, course 2 cites OSHA Subparts X and M line by line, every question is drawn from its reading, and course 2 awaits Robert." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
