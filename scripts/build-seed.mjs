// Parses db/content-pack.md (the approved launch content) into db/seed.sql + db/missions.json
// Single source of truth: edit the markdown, re-run `npm run seed`.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(root, 'db/content-pack.md'), 'utf8');

const PERSONA_MAP = [
  ['Small-business owner', 'shop'],
  ['Parent', 'parent'],
  ['Office worker', 'office'],
  ['Job-seeker', 'job'],
  ['Retiree', 'retiree'],
];

const q = (s) => `'${String(s).trim().replace(/'/g, "''")}'`;
const grab = (block, label) => {
  const m = block.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`));
  return m ? m[1].trim() : null;
};

const days = md.split(/^# DAY /m).slice(1);
if (days.length !== 7) throw new Error(`Expected 7 days, got ${days.length}`);

const missions = [];
for (const raw of days) {
  const head = raw.match(/^(\d+) · ([^\n]+)\n## ([^\n]+)/);
  if (!head) throw new Error('Day header parse failed: ' + raw.slice(0, 80));
  const id = Number(head[1]);
  const domain = head[2].trim();
  const title = head[3].trim();
  const skill = grab(raw, 'Skill');
  const emailSubject = grab(raw, 'Email subject');
  const winMessage = grab(raw, 'Win message');
  if (!skill || !emailSubject || !winMessage) throw new Error(`Day ${id}: missing header field`);
  const noteM = raw.match(/^\*Note for all personas: ([^*]+)\*/m);
  const note = noteM ? noteM[1].trim() : null;

  // personas
  const sections = raw.split(/^### /m).slice(1);
  const personas = [];
  const roundsBlockIdx = sections.findIndex((s) => s.startsWith('🎯'));
  const personaSections = sections.filter((s) => !s.startsWith('🎯'));
  if (personaSections.length !== 5) throw new Error(`Day ${id}: expected 5 personas, got ${personaSections.length}`);
  for (const sec of personaSections) {
    const h = sec.match(/^[^\n]*?([A-Za-z][\w -]+?) — ([^\n]+)\n/);
    if (!h) throw new Error(`Day ${id}: persona header parse failed: ` + sec.slice(0, 60));
    const pm = PERSONA_MAP.find(([name]) => sec.slice(0, 60).includes(name));
    if (!pm) throw new Error(`Day ${id}: unknown persona: ` + sec.slice(0, 60));
    const storyTitle = h[2].trim();
    const story = sec.split('\n').slice(1).join('\n').split('**Prompt:**')[0].trim();
    const promptM = sec.match(/\*\*Prompt:\*\*\s*"([\s\S]+?)"\s*\n\s*\n\*\*Why it works:\*\*/);
    const whyM = sec.match(/\*\*Why it works:\*\*\s*([\s\S]+?)(?=\n### |\n---|$)/);
    if (!promptM || !whyM) throw new Error(`Day ${id} ${pm[1]}: prompt/why parse failed`);
    personas.push({ persona: pm[1], storyTitle, story, prompt: promptM[1].trim(), why: whyM[1].trim() });
  }

  // challenge rounds
  const challengeSec = sections[roundsBlockIdx];
  const roundChunks = challengeSec.split(/^\*\*Round /m).slice(1);
  if (roundChunks.length !== 4) throw new Error(`Day ${id}: expected 4 rounds, got ${roundChunks.length}`);
  const rounds = roundChunks.map((rc) => {
    const hm = rc.match(/^(\d+)[^—]*— ([^\n]+?)\*\*\n/);
    const a = rc.match(/^A: ([\s\S]+?)\nB: /m);
    const b = rc.match(/^B: ([\s\S]+?)\n\*\*Winner/m);
    const w = rc.match(/\*\*Winner: ([AB])\.\*\*\s*([\s\S]+?)(?=\n\n\*\*Round |\n\n---|\n---|$)/);
    if (!hm || !a || !b || !w) throw new Error(`Day ${id}: round parse failed: ` + rc.slice(0, 60));
    const strip = (s) => s.trim().replace(/^"|"$/g, '');
    return {
      round: Number(hm[1]),
      task: hm[2].trim().replace(/\.$/, '') + '.',
      promptA: strip(a[1]),
      promptB: strip(b[1]),
      winner: w[1].toLowerCase(),
      verdict: w[2].trim(),
    };
  });

  missions.push({ id, domain, title, skill, emailSubject, winMessage, note, personas, rounds });
}

// sanity totals
const totalPersonas = missions.reduce((n, m) => n + m.personas.length, 0);
const totalRounds = missions.reduce((n, m) => n + m.rounds.length, 0);
if (totalPersonas !== 35 || totalRounds !== 28) {
  throw new Error(`Totals wrong: ${totalPersonas} personas, ${totalRounds} rounds`);
}

// emit SQL
let sql = '-- AUTO-GENERATED from content-pack.md by scripts/build-seed.mjs — do not edit by hand\n';
sql += 'DELETE FROM challenge_rounds; DELETE FROM mission_content; DELETE FROM missions;\n';
for (const m of missions) {
  sql += `INSERT INTO missions (id, domain, title, skill, email_subject, win_message, note) VALUES (${m.id}, ${q(m.domain)}, ${q(m.title)}, ${q(m.skill)}, ${q(m.emailSubject)}, ${q(m.winMessage)}, ${m.note ? q(m.note) : 'NULL'});\n`;
  for (const p of m.personas) {
    sql += `INSERT INTO mission_content (mission_id, persona, story_title, story, prompt, why) VALUES (${m.id}, ${q(p.persona)}, ${q(p.storyTitle)}, ${q(p.story)}, ${q(p.prompt)}, ${q(p.why)});\n`;
  }
  for (const r of m.rounds) {
    sql += `INSERT INTO challenge_rounds (mission_id, round, task, prompt_a, prompt_b, winner, verdict) VALUES (${m.id}, ${r.round}, ${q(r.task)}, ${q(r.promptA)}, ${q(r.promptB)}, ${q(r.winner)}, ${q(r.verdict)});\n`;
  }
}
writeFileSync(join(root, 'db/seed.sql'), sql);
writeFileSync(join(root, 'db/missions.json'), JSON.stringify(missions, null, 2));
console.log(`OK: ${missions.length} missions, ${totalPersonas} persona blocks, ${totalRounds} rounds`);
