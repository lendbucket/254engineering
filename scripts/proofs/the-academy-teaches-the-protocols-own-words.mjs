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
 *   - course 2 has no lessons, says it awaits Robert, and is the owner's;
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

check("course 2 has no lessons yet", (course2?.lessons ?? []).length === 0);
check("and says it awaits Robert", /^Awaiting Robert/.test(course2?.placeholder ?? ""));
const everything = JSON.stringify(ACADEMY_COURSES);
check("nothing in either course is a video or an image", !/\.(mp4|mov|webm|png|jpe?g|gif)\b|youtube|vimeo|<video/i.test(everything));

console.log(wrong === 0 ? "PASS: course 1 is the signed protocols' own words, every question is drawn from its reading, and course 2 awaits Robert." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
