// Agent portal pages written in OpenUI Lang, drawn with the kit's "Signal box" styles.
// The components carry the status guide: a Question can't render without its options, pick and
// what happens if nobody answers. Buttons only ask the portal (window.AGL from the kit).
// Add props only at the end of a schema: argument order is prop order, and stored pages must keep parsing.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { defineComponent, createLibrary, Renderer } from '@openuidev/react-lang';
import { z } from 'zod';

const STATES = ['needs-you', 'blocked', 'working', 'done', 'idle'];
const LABEL = { 'needs-you': 'Needs you', blocked: 'Blocked', working: 'Working', done: 'Done', idle: 'Idle' };
const ask = (o) => window.AGL && window.AGL.ask(o);
const nodes = z.array(z.any());
const propsOf = (list) => (list || []).map((n) => n && n.props).filter(Boolean);

// Answers the portal already holds (sent to the kit on load); a Question with one stops asking.
function useAnswer(id) {
  const read = () => (window.AGL && window.AGL.answers && window.AGL.answers[String(id || '').toUpperCase()]) || null;
  const [answer, setAnswer] = React.useState(read);
  React.useEffect(() => { const on = () => setAnswer(read()); addEventListener('agl-answers', on); on(); return () => removeEventListener('agl-answers', on); }, [id]);
  return answer;
}

const Chip = ({ state, children }) => <span className={'agl-chip ' + state}>{children || LABEL[state] || state}</span>;
const StopIcon = () => <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
const StopButton = () => <button className="agl-btn quiet agl-stop" aria-label="Stop audio" onClick={() => ask({ kind: 'stop' })}><StopIcon />Stop audio</button>;
const Speaker = () => <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>;

// Inline SVG from the agent; the page is sandboxed with no network, so markup can't reach anything.
function Svg({ markup, caption }) {
  if (!/^\s*<svg[\s>]/i.test(markup || '')) return null;
  return <figure className="agl-figure"><div dangerouslySetInnerHTML={{ __html: markup }} />{caption ? <figcaption>{caption}</figcaption> : null}</figure>;
}
const Figure = defineComponent({ name: 'Figure', description: 'A diagram: inline <svg> with a viewBox 720 wide, role="img", an aria-label stating the conclusion, kit classes d-box, d-hi, d-line, d-label, d-title, d-meta instead of colours, plus a caption saying what to notice',
  props: z.object({ svg: z.string(), caption: z.string() }),
  component: ({ props }) => <Svg markup={props.svg} caption={props.caption} /> });

const Option = defineComponent({ name: 'Option', description: 'One lettered answer to a question',
  props: z.object({ letter: z.string().describe('A, B, C'), text: z.string() }),
  component: ({ props }) => <span><b>{props.letter})</b> {props.text} </span> });

const Question = defineComponent({ name: 'Question', description: 'A question to the user, inside its work item',
  props: z.object({ id: z.string().describe('Q7'), work: z.string(), asked: z.string().describe('when and where'), question: z.string(),
    options: nodes.describe('Option list'), pick: z.string().describe('your pick, a letter'), ifSilent: z.string().describe('what happens if nobody answers'),
    diagram: z.string().optional().describe('optional inline <svg> that helps the user decide') }),
  component: ({ props }) => {
    const opts = propsOf(props.options);
    const answer = useAnswer(props.id);
    const [chosen, setChosen] = React.useState(props.pick);
    if (answer) {
      const waiting = answer.status === 'submitted';
      return <div className="agl-answered" data-agl-managed="" aria-live="polite">
        <Chip state={waiting ? 'working' : 'done'}>{waiting ? 'Sent ' + answer.at + ', waiting for agent' : 'Answered ' + answer.at + ', agent has acted'}</Chip>
        <span><b>{props.id}</b> {props.question} {answer.choice ? <b>· {answer.kind === 'comment' ? 'comment' : answer.choice}</b> : null}</span>
      </div>;
    }
    const pickText = (opts.find((o) => o.letter === chosen) || {}).text || '';
    const move = (e, i) => { if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return; e.preventDefault(); const next = opts[(i + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length]; setChosen(next.letter); e.currentTarget.parentNode.children[opts.indexOf(next)].focus(); };
    return <div className="agl-decision" data-agl-managed="">
      <div className="agl-from"><span>{props.id}</span><span>{props.work}</span><span>{props.asked}</span></div>
      <div className="agl-q" id={'q-' + props.id}>{props.question}</div>
      {props.diagram ? <Svg markup={props.diagram} /> : null}
      <div className="agl-options" role="radiogroup" aria-labelledby={'q-' + props.id}>
        {opts.map((o, i) => <div key={o.letter} className="agl-option" role="radio" aria-checked={chosen === o.letter} tabIndex={chosen === o.letter ? 0 : -1}
          onClick={() => setChosen(o.letter)} onKeyDown={(e) => move(e, i)}>
          <span className="agl-letter">{o.letter}</span><span>{o.text} {o.letter === props.pick ? <Chip state="idle">Recommended</Chip> : null}</span></div>)}
      </div>
      <div className="agl-meta">If no answer: {props.ifSilent}</div>
      <div className="agl-actions">
        <button className="agl-btn primary" data-agl-question={props.id} onClick={() => ask({ kind: 'approve', question: props.id, choice: chosen, label: pickText })}>{chosen === props.pick ? 'Approve' : 'Choose'} {chosen}</button>
        <button className="agl-btn" data-agl-question={props.id} onClick={() => ask({ kind: 'comment', question: props.id })}>Comment</button>
        <button className="agl-btn quiet agl-listen" aria-label={'Read ' + props.id + ' aloud'} onClick={() => ask({ kind: 'speak', label: `${props.id}. ${props.question} ${opts.map((o) => 'Option ' + o.letter + ': ' + o.text + '.').join(' ')} My pick: ${props.pick}.` })}><Speaker />Listen</button><StopButton />
      </div>
    </div>;
  } });

const Milestone = defineComponent({ name: 'Milestone', description: 'One milestone the user would recognise',
  props: z.object({ label: z.string(), status: z.enum(['done', 'current', 'todo']) }),
  component: ({ props }) => <li>{props.label} ({props.status})</li> });

// The progress track: a line with stations; done filled, current a ring, todo hollow.
function Track({ milestones }) {
  const n = milestones.length; if (!n) return null;
  const W = 720, pad = 12, step = n > 1 ? (W - 2 * pad) / (n - 1) : 0, x = (i) => pad + i * step;
  const last = milestones.map((m) => m.status).lastIndexOf('done');
  const current = milestones.findIndex((m) => m.status === 'current');
  const labelAll = n <= 6;
  return <figure className="agl-figure" style={{ margin: '8px 0' }}>
    <svg viewBox={`0 0 ${W} ${labelAll ? 64 : 48}`} role="img" aria-label={`${milestones.filter((m) => m.status === 'done').length} of ${n} milestones done${current >= 0 ? '; now: ' + milestones[current].label : ''}`}>
      <line x1={x(0)} y1="14" x2={x(n - 1)} y2="14" stroke="var(--agl-line-strong)" strokeWidth="2" />
      {last > 0 ? <line x1={x(0)} y1="14" x2={x(last)} y2="14" stroke="var(--agl-done-rail)" strokeWidth="2" /> : null}
      {milestones.map((m, i) => m.status === 'done' ? <circle key={i} cx={x(i)} cy="14" r="5" fill="var(--agl-done-rail)" />
        : m.status === 'current' ? <g key={i}><circle cx={x(i)} cy="14" r="6" fill="var(--agl-surface)" stroke="var(--agl-working-rail)" strokeWidth="2.5" /><circle cx={x(i)} cy="14" r="2" fill="var(--agl-working-rail)" /></g>
          : <circle key={i} cx={x(i)} cy="14" r="5" fill="var(--agl-surface)" stroke="var(--agl-line-strong)" strokeWidth="2" />)}
      {milestones.map((m, i) => (labelAll || i === current) ? <text key={'t' + i} x={x(i)} y="40" fontSize="12" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fill={i === current ? 'var(--agl-ink)' : 'var(--agl-ink-3)'} fontWeight={i === current ? 600 : 400}>{m.label}<title>{m.label}: {m.status}</title></text>
        : <title key={'t' + i}>{m.label}: {m.status}</title>)}
    </svg>
  </figure>;
}

const Delivery = defineComponent({ name: 'Delivery', description: 'Something delivered, with evidence',
  props: z.object({ when: z.string(), what: z.string(), evidence: z.string().describe('commit, test count, URL or screenshot') }),
  component: ({ props }) => <li><time>{String(props.when).replace(/^\d\d-\d\d /, '')}</time><span>{props.what}<span className="agl-ev">{props.evidence}</span></span></li> });

const WorkItem = defineComponent({ name: 'WorkItem', description: 'One piece of work the user gave you',
  props: z.object({ name: z.string().describe("the user's own term"), state: z.enum(STATES), goal: z.string(), milestones: nodes, delivered: nodes, next: z.string(), archived: z.boolean().optional().describe('true moves it out of the sidebar into Archive') }),
  component: ({ props, renderNode }) => {
    const ms = propsOf(props.milestones);
    const [all, setAll] = React.useState(false);
    const delivered = props.delivered || [];
    if (props.state === 'idle' || props.state === 'done') return <section className={'agl-card agl-rail s-' + props.state} data-agl-work={props.name} tabIndex={-1}>
      <div className="agl-row"><b>{props.name}</b><Chip state={props.state}>{props.state === 'idle' ? 'Parked' : 'Done'}</Chip><span className="agl-muted">{props.goal}</span></div></section>;
    return <section className={'agl-card agl-rail s-' + props.state} data-agl-work={props.name} tabIndex={-1}>
      <div className="agl-row" style={{ justifyContent: 'space-between' }}><div className="agl-row"><h2 style={{ margin: 0 }}>{props.name}</h2><Chip state={props.state} /></div>
        <span className="agl-muted">{ms.filter((m) => m.status === 'done').length} of {ms.length}</span></div>
      <Track milestones={ms} />
      <div className="agl-next">Next: {props.next}</div>
      <p style={{ color: 'var(--agl-ink-2)' }}>{props.goal}</p>
      {delivered.length ? <><h3>Delivered</h3><ul className="agl-timeline">{renderNode(all ? delivered : delivered.slice(0, 3))}</ul>
        {delivered.length > 3 ? <button className="agl-btn quiet" onClick={() => setAll(!all)}>{all ? 'Show fewer' : 'Show all ' + delivered.length}</button> : null}</> : null}
    </section>;
  } });

const HEALTH = { running: 'done', degraded: 'blocked', down: 'needs-you', stopped: 'idle' };
const Running = defineComponent({ name: 'Running', description: 'Something you run, with health',
  props: z.object({ what: z.string(), health: z.enum(['running', 'degraded', 'down', 'stopped']), where: z.string(), since: z.string() }),
  component: ({ props }) => <tr className={'s-' + HEALTH[props.health]}><td><span className="agl-row" style={{ gap: 8 }}><span className="agl-dot" />{props.health}</span></td><td>{props.what}</td><td className="agl-mono">{props.where}</td><td className="agl-muted">{props.since}</td></tr> });

const Entry = defineComponent({ name: 'Entry', description: 'One history line, newest first',
  props: z.object({ when: z.string(), kind: z.enum(['TOOK', 'DELIVERED', 'DROPPED']), what: z.string() }),
  component: ({ props }) => <li className={props.kind === 'TOOK' ? 'took' : props.kind === 'DROPPED' ? 'dropped' : ''}><time>{String(props.when).replace(/^\d\d-\d\d /, '')}</time><span>{({ TOOK: 'Took', DELIVERED: 'Delivered', DROPPED: 'Dropped' })[props.kind]} {props.what}</span></li> });

// Day separators for timelines: entries carry "MM-DD HH:MM".
function byDay(list, renderNode) {
  const out = []; let day = null;
  const today = new Date(); const fmt = (d) => String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const yesterday = new Date(today - 864e5);
  for (const n of list) { const d = String((n && n.props && n.props.when) || '').slice(0, 5); if (d !== day) { day = d; out.push(<li key={'d' + d} className="agl-day" style={{ display: 'block', padding: 0 }} aria-hidden="false">{d === fmt(today) ? 'Today' : d === fmt(yesterday) ? 'Yesterday' : d}</li>); } out.push(<React.Fragment key={out.length}>{renderNode(n)}</React.Fragment>); }
  return out;
}

function History({ entries, renderNode }) {
  const [all, setAll] = React.useState(false);
  const shown = all ? entries : entries.slice(0, 10);
  return <section className="agl-card"><h2>History</h2><ul className="agl-timeline">{byDay(shown, renderNode)}</ul>
    {entries.length > 10 ? <button className="agl-btn quiet" onClick={() => setAll(!all)}>{all ? 'Show fewer' : 'Show older (' + (entries.length - 10) + ')'}</button> : null}</section>;
}

const Status = defineComponent({ name: 'Status', description: "An agent's status page, organised by work",
  props: z.object({ state: z.enum(STATES), headline: z.string().max(80), updated: z.string().describe('from the clock'),
    needs: nodes.describe('open Question list, at most 3'), work: nodes.describe('WorkItem list'), running: nodes.describe('Running list'), history: nodes.describe('Entry list') }),
  component: ({ props, renderNode }) => {
    const running = propsOf(props.running);
    const loud = running.filter((r) => r.health === 'down' || r.health === 'degraded');
    const needs = props.needs || [];
    return <div className="agl-page">
      <header className={'agl-card agl-rail s-' + props.state}>
        <div className="agl-row"><Chip state={props.state} /><span className="agl-muted">Updated {props.updated}</span>
          <button className="agl-btn quiet agl-listen" style={{ marginLeft: 'auto' }} aria-label="Read the headline and open questions aloud" onClick={() => ask({ kind: 'speak', label: props.headline + '. ' + (needs.length ? needs.length + ' question' + (needs.length > 1 ? 's' : '') + ' for you.' : 'Nothing needs you.') })}><Speaker />Listen</button><StopButton /></div>
        <h1 style={{ marginTop: 8 }}>{props.headline}</h1>
        {loud.length ? <p style={{ color: 'var(--agl-needs-you)', fontWeight: 600, marginTop: 8 }}>{loud.length} server{loud.length > 1 ? 's' : ''} {loud.map((r) => r.health).join(', ')}: {loud.map((r) => r.what).join(', ')}</p> : null}
        {!needs.length ? <p className="agl-meta" style={{ color: 'var(--agl-done)', marginTop: 8 }}>Nothing needs you.</p> : null}
      </header>
      {needs.length ? <section className="agl-card attention"><h2>Needs you ({needs.length})</h2>{renderNode(needs)}</section> : null}
      {renderNode(props.work)}
      {running.length ? <section className="agl-card"><h2>Workspace</h2><div className="agl-scroll"><table className="agl-table"><thead><tr><th>Health</th><th>What</th><th>Where</th><th>Since</th></tr></thead><tbody>{renderNode(props.running)}</tbody></table></div></section> : null}
      {(props.history || []).length ? <History entries={props.history} renderNode={renderNode} /> : null}
    </div>;
  } });

// ---- Document pages: proposals, designs, guides, questions, responsibility ----
// Inline marks in Text: **bold**, `code`, [label](target). A target naming another page of this session
// (slug, slug.md, pages/slug.html) asks the portal to open it; the sandbox can't navigate by itself.
function inline(text) {
  const out = []; const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w*])\*([^*\n]+)\*(?![\w*])/g; let last = 0, m, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<b key={k++}>{m[1]}</b>);
    else if (m[2]) out.push(<code key={k++}>{m[2]}</code>);
    else if (m[5]) out.push(<em key={k++}>{m[5]}</em>);
    else if (m[3]) { const slug = (m[4].match(/^(?:\.\.?\/)*(?:\.agl\/)?(?:pages\/)?([a-z0-9][a-z0-9-]*|STATUS|FACTS)(?:\.(?:md|html|openui))?$/) || [])[1];
      out.push(slug ? <a key={k++} href={'#' + slug} onClick={(e) => { e.preventDefault(); window.AGL && window.AGL.go && window.AGL.go(slug); }}>{m[3]}</a> : <span key={k++} title={m[4]}>{m[3]}</span>); }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
const Text = defineComponent({ name: 'Text', description: 'Prose; blank lines separate paragraphs; **bold**, `code` and [label](other-page) inside',
  props: z.object({ text: z.string() }),
  component: ({ props }) => <>{String(props.text).split(/\n\s*\n/).map((para, i) => <p key={i}>{inline(para.replace(/\s*\n\s*/g, ' '))}</p>)}</> });
const Bullets = defineComponent({ name: 'Bullets', description: 'A list; ordered=true numbers it',
  props: z.object({ items: z.array(z.string()), ordered: z.boolean().optional() }),
  component: ({ props }) => React.createElement(props.ordered ? 'ol' : 'ul', { className: 'agl-list' }, (props.items || []).map((t, i) => <li key={i}>{inline(t)}</li>)) });
const Table = defineComponent({ name: 'Table', description: 'A table: column names, then rows of cells',
  props: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }),
  component: ({ props }) => <div className="agl-scroll"><table className="agl-table"><thead><tr>{props.columns.map((c, i) => <th key={i}>{inline(c)}</th>)}</tr></thead>
    <tbody>{(props.rows || []).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table></div> });
const Code = defineComponent({ name: 'Code', description: 'Preformatted code or commands',
  props: z.object({ text: z.string() }),
  component: ({ props }) => <pre className="agl-code"><code>{props.text}</code></pre> });
const Callout = defineComponent({ name: 'Callout', description: 'A highlighted note; state colours it (needs-you for warnings)',
  props: z.object({ state: z.enum(STATES), text: z.string() }),
  component: ({ props }) => <div className={'agl-callout s-' + props.state}>{String(props.text).split(/\n\s*\n/).map((para, i) => <p key={i}>{inline(para)}</p>)}</div> });
const Section = defineComponent({ name: 'Section', description: 'A headed part of a page; level 3 for a sub-heading',
  props: z.object({ heading: z.string(), blocks: nodes, level: z.number().optional() }),
  component: ({ props, renderNode }) => props.level === 3
    ? <div className="agl-sub"><h3>{inline(props.heading)}</h3>{renderNode(props.blocks)}</div>
    : <section className="agl-card"><h2>{inline(props.heading)}</h2>{renderNode(props.blocks)}</section> });
const Page = defineComponent({ name: 'Page', description: 'A document page: title, one-line summary, kind, its work item, updated, then blocks',
  props: z.object({ title: z.string(), summary: z.string(), kind: z.string().describe('proposal, design, guide, review, questions, responsibility'), work: z.string(), updated: z.string(), blocks: nodes }),
  component: ({ props, renderNode }) => <div className="agl-page">
    <header className="agl-card"><div className="agl-row"><span className="agl-chip idle">{props.kind}</span><span className="agl-muted">{props.work ? props.work + ' · ' : ''}Updated {props.updated}</span></div>
      <h1 style={{ marginTop: 8 }}>{props.title}</h1><p className="agl-muted" style={{ marginTop: 4 }}>{props.summary}</p></header>
    {renderNode(props.blocks)}
  </div> });

const ALL = [Status, Page, Section, Text, Bullets, Table, Code, Callout, WorkItem, Milestone, Delivery, Question, Option, Running, Entry, Figure];
export const library = createLibrary({ root: 'Status', components: ALL });
export const pageLibrary = createLibrary({ root: 'Page', components: ALL });

function Errors({ errors }) {
  if (!errors.length) return null;
  return <section className="agl-card attention" style={{ marginBottom: 16 }}><h2>This page breaks the status rules</h2><ul>{errors.map((e, i) => <li key={i}>{e.code}: {e.message || JSON.stringify(e)}</li>)}</ul></section>;
}
function App({ program }) {
  const [errors, setErrors] = React.useState([]);
  const lib = /^\s*root\s*=\s*Page\(/m.test(program) ? pageLibrary : library;
  return <><Errors errors={errors} /><Renderer response={program} library={lib} isStreaming={false} onError={setErrors} /></>;
}
if (typeof document !== 'undefined') {
  const start = () => { const el = document.getElementById('openui-program'); const root = document.getElementById('openui-root'); if (el && root) createRoot(root).render(<App program={el.value || el.textContent} />); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
