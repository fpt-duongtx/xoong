// Screen tests for a chat client built on xoong, against the (anonymised) chat-service API.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { mount, mockApi, respond } from '@xoong/test';
import { analyze, runtimeTable } from '../../../packages/cli/src/openapi.js';

// The same pipeline `xoong sync` runs, in memory: spec + frontend hints -> operations table.
const spec = JSON.parse(readFileSync('examples/chat/openapi.json', 'utf8'));
const hints = JSON.parse(readFileSync('examples/chat/xoong.hints.json', 'utf8'));
const table = runtimeTable(analyze(spec, { hints }));

const SID = '3f2b8c1e-8c0e-4d57-9a41-6f1d2d9e0a11';
const session = (over = {}) => ({ session_id: SID, session_active: true, authenticated: false, turn: 0, pending_action: null, tasks: [], ...over });
const chat = (over = {}) => ({ session_id: SID, turn: 1, reply: { seq: 2, role: 'assistant', content: 'Hello!', widgets: [] }, authenticated: false, pending_action: null, tasks: [], session_active: true, cancelled: false, ...over });

let screen;
afterEach(() => screen?.unmount());

const OP = {
  getSession: 'get_session_v1_sessions__sid__get',
  history: 'history_v1_sessions__sid__messages_get',
  send: 'send_message_v1_sessions__sid__messages_post',
  otp: 'send_otp_v1_sessions__sid__auth_otp_post',
};

describe('the chat-service spec as xoong sees it', () => {
  it('detects Session and TaskView as shared entities', () => {
    expect(Object.keys(table.entities).sort()).toEqual(['Session', 'TaskView']);
    expect(table.entities.Session.id).toBe('session_id');
    expect(table.operations[OP.getSession].response).toEqual({ t: 'entity', name: 'Session' });
    expect(table.operations[OP.history].query).toEqual(['before_seq', 'limit']);
  });
});

describe('chat screen', () => {
  const html = `
    <xo-view get="/v1/sessions/{sid}" p-sid="${SID}">
      <p xo-if="$error" class="err">{$error.code}: {$error.detail}</p>
      <p class="turn">turn {turn}</p>
      <ul class="tasks"><li xo-each="tasks"><b>{intent}</b> <i>{status}</i></li></ul>
      <p xo-if="pending_action" class="auth">sign in via {pending_action.type}</p>
      <form xo-submit="POST /v1/sessions/{sid}/messages">
        <input name="message"><input type="hidden" name="client_message_id" value="m-1"><button>send</button>
      </form>
    </xo-view>`;

  it('shows the session, and sending a message updates the SAME session record (no refetch)', async () => {
    const api = mockApi(table, {
      [OP.getSession]: () => session(),
      [OP.send]: ({ body }) => chat({ turn: 1, tasks: [{ task_id: 't1', intent: 'balance', status: 'running' }] }),
    });
    screen = await mount(html, { api });
    expect(screen.text('.turn')).toBe('turn 0');

    await screen.submit('form', { message: 'what is my balance?' });

    expect(api.callsOf(OP.send)[0]).toMatchObject({ params: { sid: SID }, body: { message: 'what is my balance?', client_message_id: 'm-1' } });
    expect(screen.text('.turn')).toBe('turn 1');                 // Session updated by the ChatResponse
    expect(screen.texts('.tasks li')).toEqual(['balance running']); // TaskView appeared
    expect(api.callsOf(OP.getSession)).toHaveLength(1);          // ...without refetching the session
    expect(screen.errors).toEqual([]);
  });

  it('shows the backend error envelope', async () => {
    const api = mockApi(table, { [OP.getSession]: () => respond(404, { error: { code: 'session_not_found', message: 'No such session' } }) });
    screen = await mount(html, { api });
    expect(screen.text('.err')).toBe('session_not_found: No such session');
  });

  it('a rate-limited send exposes code and retry hint through xo-error', async () => {
    const api = mockApi(table, {
      [OP.getSession]: () => session(),
      [OP.send]: () => respond(429, { error: { code: 'rate_limited', message: 'Too many messages', retry_after_s: 12 } }),
    });
    screen = await mount(html, { api });
    await screen.submit('form', { message: 'hi' });
    expect(screen.errors).toHaveLength(1);
    expect(screen.errors[0]).toMatchObject({ status: 429, code: 'rate_limited', retryAfterS: 12 });
  });

  it('a pending auth action renders when the session reports one', async () => {
    const api = mockApi(table, { [OP.getSession]: () => session({ pending_action: { type: 'auth_required', task_id: 't9', methods: ['otp'] } }) });
    screen = await mount(html, { api });
    expect(screen.text('.auth')).toBe('sign in via auth_required');
  });
});
