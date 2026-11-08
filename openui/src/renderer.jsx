// Trial: an agent's status page written in OpenUI Lang, drawn with the agent portal kit.
// The components carry the status guide: a Question can't render without its options, pick and
// what happens if nobody answers. Buttons only ask the portal (window.AGL from the kit).
import React from 'react';
import { createRoot } from 'react-dom/client';
import { defineComponent, createLibrary, Renderer } from '@openuidev/react-lang';
import { z } from 'zod';

const STATES = ['needs-you', 'blocked', 'working', 'done', 'idle'];
// Answers the portal already holds (sent to the kit on load); a Question with one stops asking.
function useAnswer(id) {
  const read = () => (window.AGL && window.AGL.answers && window.AGL.answers[String(id || '').toUpperCase()]) || null;
  const [answer, setAnswer] = React.useState(read);
  React.useEffect(() => { const on = () => setAnswer(read()); addEventListener('agl-answers', on); on(); return () => removeEventListener('agl-answers', on); }, [id]);
  return answer;
}
const ask = (o) => window.AGL && window.AGL.ask(o);
const nodes = z.array(z.any());

const Option = defineComponent({ name: 'Option', description: 'One lettered answer to a question',
  props: z.object({ letter: z.string().describe('A, B, C'), text: z.string() }),
  component: ({ props }) => <span><b>{props.letter})</b> {props.text} </span> });

const Question = defineComponent({ name: 'Question', description: 'A question to the user, inside its work item',
  props: z.object({ id: z.string().describe('Q7'), work: z.string(), asked: z.string().describe('when and where'), question: z.string(),
    options: nodes.describe('Option list'), pick: z.string().describe('your pick, a letter'), ifSilent: z.string().describe('what happens if nobody answers') }),
  component: ({ props, renderNode }) => {
    const opts = (props.options || []).map((o) => o && o.props).filter(Boolean);
    const answer = useAnswer(props.id);
    if (answer) return <div className="agl-decision agl-answered" data-agl-managed="">
      <span className={'agl-chip ' + (answer.status === 'submitted' ? 'blocked' : 'done')}>{answer.kind === 'comment' ? 'You commented' : answer.kind === 'no' ? 'You said no' : 'You chose ' + (answer.choice || 'yes')} at {answer.at}{answer.status === 'submitted' ? ' · waiting for the agent' : ' · the agent has acted'}</span>
      <span className="agl-from">{props.id} · {props.work} · {props.asked}</span>
      <span className="agl-q">{props.question}</span>
    </div>;
    return <div className="agl-decision" data-agl-managed="">
      <span className="agl-from">{props.id} · {props.work} · {props.asked}</span>
      <span className="agl-q">{props.question}</span>
      <span>{renderNode(props.options)}</span>
      <span><b>My pick: {props.pick}.</b> If no answer: {props.ifSilent}</span>
      <div className="agl-row">
        {opts.map((o) => <button key={o.letter} className={'agl-btn' + (o.letter === props.pick ? ' primary' : '')} data-agl-question={props.id}
          onClick={() => ask({ kind: 'approve', question: props.id, choice: o.letter, label: o.text })}>{o.letter === props.pick ? 'Approve ' : 'Choose '}{o.letter}</button>)}
        <button className="agl-btn" data-agl-question={props.id} onClick={() => ask({ kind: 'comment', question: props.id })}>Comment</button>
        <button className="agl-btn agl-listen" onClick={() => ask({ kind: 'speak', label: `${props.id}. ${props.question} ${opts.map((o) => o.letter + ': ' + o.text + '.').join(' ')} My pick: ${props.pick}.` })}>Listen</button>
      </div>
    </div>;
  } });

const Milestone = defineComponent({ name: 'Milestone', description: 'One milestone the user would recognise',
  props: z.object({ label: z.string(), status: z.enum(['done', 'current', 'todo']) }),
  component: ({ props }) => <li><span className={'agl-chip ' + (props.status === 'done' ? 'done' : props.status === 'current' ? 'working' : 'idle')}>{props.status}</span> {props.label}</li> });

const Delivery = defineComponent({ name: 'Delivery', description: 'Something delivered, with evidence',
  props: z.object({ when: z.string(), what: z.string(), evidence: z.string().describe('commit, test count, URL or screenshot') }),
  component: ({ props }) => <li><time>{props.when}</time><span>{props.what} <span className="agl-muted">({props.evidence})</span></span></li> });

const WorkItem = defineComponent({ name: 'WorkItem', description: 'One piece of work the user gave you',
  props: z.object({ name: z.string().describe("the user's own term"), state: z.enum(STATES), goal: z.string(), milestones: nodes, delivered: nodes, next: z.string() }),
  component: ({ props, renderNode }) => {
    const ms = (props.milestones || []).map((m) => m && m.props).filter(Boolean);
    return <section className="agl-card">
      <div className="agl-row"><span className={'agl-chip ' + props.state}>{props.state}</span><span className="agl-muted">Work item · {ms.filter((m) => m.status === 'done').length} of {ms.length} milestones done</span></div>
      <h2>{props.name}</h2>
      <p><b>Goal:</b> {props.goal}</p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>{renderNode(props.milestones)}</ul>
      <h3>Delivered</h3>
      <ul className="agl-timeline">{renderNode(props.delivered)}</ul>
      <p><b>Next:</b> {props.next}</p>
    </section>;
  } });

const Running = defineComponent({ name: 'Running', description: 'Something you run, with health',
  props: z.object({ what: z.string(), health: z.enum(['running', 'degraded', 'down', 'stopped']), where: z.string(), since: z.string() }),
  component: ({ props }) => <tr><td>{props.what}</td><td><span className={'agl-chip ' + (props.health === 'running' ? 'done' : props.health === 'degraded' ? 'blocked' : 'idle')}>{props.health}</span></td><td>{props.where}</td><td>{props.since}</td></tr> });

const Entry = defineComponent({ name: 'Entry', description: 'One history line, newest first',
  props: z.object({ when: z.string(), kind: z.enum(['TOOK', 'DELIVERED', 'DROPPED']), what: z.string() }),
  component: ({ props }) => <li><time>{props.when}</time><span>{props.kind} · {props.what}</span></li> });

const Status = defineComponent({ name: 'Status', description: "An agent's status page, organised by work",
  props: z.object({ state: z.enum(STATES), headline: z.string().max(80), updated: z.string().describe('from the clock'),
    needs: nodes.describe('open Question list, at most 3'), work: nodes.describe('WorkItem list'), running: nodes.describe('Running list'), history: nodes.describe('Entry list') }),
  component: ({ props, renderNode }) => <div className="agl-page">
    <section className="agl-card"><div className="agl-row"><span className={'agl-chip ' + props.state}>{props.state}</span><span className="agl-muted">Updated {props.updated} · written in OpenUI</span></div><h1>{props.headline}</h1></section>
    {props.needs && props.needs.length ? <section className="agl-card attention"><h2>Needs you</h2>{renderNode(props.needs)}</section> : null}
    {renderNode(props.work)}
    <section className="agl-card"><h2>Workspace</h2><div className="agl-scroll"><table className="agl-table"><thead><tr><th>What</th><th>Health</th><th>Where</th><th>Since</th></tr></thead><tbody>{renderNode(props.running)}</tbody></table></div></section>
    <section className="agl-card"><h2>History</h2><ul className="agl-timeline">{renderNode(props.history)}</ul></section>
  </div> });

export const library = createLibrary({ root: 'Status', components: [Status, WorkItem, Milestone, Delivery, Question, Option, Running, Entry] });

function Errors({ errors }) {
  if (!errors.length) return null;
  return <section className="agl-card attention"><h2>This page breaks the status rules</h2><ul>{errors.map((e, i) => <li key={i}>{e.code}: {e.message || JSON.stringify(e)}</li>)}</ul></section>;
}
function App({ program }) {
  const [errors, setErrors] = React.useState([]);
  return <><Errors errors={errors} /><Renderer response={program} library={library} isStreaming={false} onError={setErrors} /></>;
}
if (typeof document !== 'undefined') {
  const start = () => { const el = document.getElementById('openui-program'); const root = document.getElementById('openui-root'); if (el && root) createRoot(root).render(<App program={el.textContent} />); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
