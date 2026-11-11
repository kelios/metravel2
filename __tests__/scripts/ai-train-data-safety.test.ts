import fs from 'fs';
import path from 'path';
import { makeTempDir, removeDir, runCli } from './cli-test-utils';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'scripts/ai-train');
const EVAL = path.join(ROOT, 'scripts/ai-assistant-eval');
const PYTHON = [
  'import json, pathlib, sys',
  `sys.path.insert(0, ${JSON.stringify(DIR)})`,
  'import prepare_training_data as p',
  'from sets import assistant_prompt as a',
  'class Tokenizer:',
  ' def apply_chat_template(self, messages, **kwargs):',
  '  assert kwargs.get("return_dict") is False and "tools" in kwargs',
  '  if messages[-1]["role"] != "assistant":',
  '   assert kwargs.get("add_generation_prompt") is True',
  '   return list(range(20))',
  '  return list(range(int(messages[-1]["content"].split("TOKENS=")[-1])))',
  'tokenizer = Tokenizer()',
  'identity = {"model": "fake-local-tokenizer", "files": {"chat_template": "fixed"}}',
].join('\n');

const python = (code: string) => runCli('python3', ['-I', '-c', `${PYTHON}\n${code}`]);
const row = (name: string, length = 64) => ({ messages: [
  { role: 'system', content: 'Fixture system' },
  { role: 'user', content: `Independent question ${name}` },
  { role: 'assistant', content: `Complete target ${name}; TOKENS=${length}` },
] });

describe('ai-train exact preparation and evaluation isolation', () => {
  let home: string;
  beforeEach(() => { home = makeTempDir('ai-train-safety-', { root: path.join(ROOT, '.codex-temp') }); });
  afterEach(() => removeDir(home));

  const protectionInputs = () => {
    const directory = path.join(home, 'eval');
    fs.mkdirSync(directory);
    for (const file of ['cases.jsonl', 'cases.quality.jsonl', 'cases.complex.jsonl', 'fixtures.complex.json']) fs.copyFileSync(path.join(EVAL, file), path.join(directory, file));
    return { directory, setup: `a.CONTOUR_CASES = pathlib.Path(${JSON.stringify(path.join(directory, 'cases.jsonl'))})\na._contour = None` };
  };

  const input = (overrides: Record<string, ReturnType<typeof row>[]> = {}) => {
    const data = path.join(home, 'input');
    fs.mkdirSync(data);
    for (const part of ['train', 'valid', 'test']) {
      const rows = overrides[part] ?? [row(part)];
      fs.writeFileSync(path.join(data, `${part}.jsonl`), rows.map((value) => JSON.stringify(value)).join('\n') + '\n');
      fs.writeFileSync(path.join(data, `${part}.records.jsonl`), rows.map((value, index) => JSON.stringify({ ...value, set: 'constraints', key: `${part}:${index}`, id: `${part}:${index}` })).join('\n') + '\n');
    }
    return data;
  };

  it('protects all current questions, dialog turns and punctuation variants, but permits new questions', () => {
    const result = python([
      `directory = pathlib.Path(${JSON.stringify(EVAL)})`,
      'count = 0',
      'for file in directory.glob("cases*.jsonl"):',
      ' for line in file.read_text().splitlines():',
      '  if not line.strip(): continue',
      '  case = json.loads(line)',
      '  for q in (case.get("turns") or [case["q"]]):',
      '   assert a.is_contour_question(q.upper().replace("?", " !!! "))',
      '   count += 1',
      'assert not a.is_contour_question("Независимый тренировочный вопрос про павильон Зета")',
      'print(count)',
    ].join('\n'));
    expect(result.status).toBe(0);
    expect(Number(result.stdout.trim())).toBeGreaterThan(90);
  });

  it('blocks controlled fixture names, identifiers and reference answers while allowing real corpus context', () => {
    const result = python([
      `cases = [json.loads(line) for line in pathlib.Path(${JSON.stringify(path.join(EVAL, 'cases.quality.jsonl'))}).read_text().splitlines() if line.strip()]`,
      'assert a.holdout_violation([{"role":"assistant", "content":cases[0]["reference_answer"]}])',
      'assert a.holdout_violation([{"role":"user", "content":"Покажи учебную карточку https://metravel.by/travels/eval-fixture-a"}])',
      'assert a.holdout_violation([{"role":"user", "content":"Учебная галерея А: новые условия"}])',
      'assert a.holdout_violation([{"role":"user", "content":"Материалы сайта: любые карточки\\nВопрос посетителя: " + cases[0]["q"]}])',
      'assert a.holdout_violation([{"role":"user", "content":"Новый вопрос по источнику https://metravel.by/quests/krakow/krakow-dragon"}]) is None',
    ].join('\n'));
    expect(result.status).toBe(0);
  });

  it('fails closed when required evaluation inputs are missing or malformed, and discovers new case files', () => {
    const { directory, setup } = protectionInputs();
    fs.writeFileSync(path.join(directory, 'cases.future.jsonl'), '{"q":"Будущий независимый тест?"}\n');
    expect(python(`${setup}\nassert a.is_contour_question('БУДУЩИЙ независимый тест!')`).status).toBe(0);
    fs.writeFileSync(path.join(directory, 'cases.future.jsonl'), 'broken');
    expect(python(`${setup}\na.is_contour_question('q')`).status).not.toBe(0);
    fs.unlinkSync(path.join(directory, 'cases.quality.jsonl'));
    const missing = python(`${setup}\na.is_contour_question('q')`);
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain('missing required evaluation input');
  });

  it.each(['cases.jsonl', 'cases.quality.jsonl', 'cases.complex.jsonl'])('rejects a semantically empty required question file: %s', (file) => {
    const { directory, setup } = protectionInputs();
    for (const content of ['', ' \n\t\n']) {
      fs.writeFileSync(path.join(directory, file), content);
      const result = python(`${setup}\na.holdout_provenance()`);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('empty required evaluation cases');
    }
  });

  it.each([
    'null',
    '[]',
    '{}',
    '{"q":12}',
    '{"q":" ??? "}',
    '{"turns":"A valid-looking question"}',
    '{"q":"Fallback must not hide invalid turns", "turns":[]}',
    '{"turns":["Valid question",null]}',
    '{"q":"Valid question", "history":{}}',
    '{"q":"Valid question", "history":[{"role":"user","text":" "}]}',
    '{"q":"Valid question", "reference_answer":[]}',
  ])('rejects structurally invalid protection questions: %s', (content) => {
    const { directory, setup } = protectionInputs();
    fs.writeFileSync(path.join(directory, 'cases.complex.jsonl'), `${content}\n`);
    const result = python(`${setup}\na.holdout_provenance()`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('invalid evaluation');
  });

  it.each([
    '[]',
    '{}',
    '[null]',
    '[{}]',
    '[{"title":12,"url":"https://metravel.by/travels/eval-fixture-x"}]',
    '[{"title":"Название","url":12}]',
    '[{"title":" — only suffix","url":"https://metravel.by/travels/eval-fixture-x"}]',
    '[{"title":"Название","url":"https://metravel.by/travels/eval-fixture-"}]',
    '[{"title":"Название","url":"not-a-url/eval-fixture-x"}]',
  ])('rejects required fixtures without meaningful controlled identities: %s', (content) => {
    const { directory, setup } = protectionInputs();
    fs.writeFileSync(path.join(directory, 'fixtures.complex.json'), content);
    const result = python(`${setup}\na.holdout_provenance()`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('evaluation fixture');
  });

  it('rejects a real-only controlled fixture file but accepts a valid reduced future registry', () => {
    const { directory, setup } = protectionInputs();
    fs.copyFileSync(path.join(EVAL, 'fixtures.quality.json'), path.join(directory, 'fixtures.complex.json'));
    const result = python(`${setup}\na.holdout_provenance()`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('no controlled identities');
    for (const file of ['cases.jsonl', 'cases.quality.jsonl', 'cases.complex.jsonl']) fs.writeFileSync(path.join(directory, file), JSON.stringify({ q: `Independent ${file}` }) + '\n');
    fs.writeFileSync(path.join(directory, 'fixtures.complex.json'), JSON.stringify([{ title: 'Другой контрольный объект', url: 'https://metravel.by/travels/eval-fixture-future' }]));
    const valid = python(`${setup}\nassert a.is_contour_question('INDEPENDENT cases.complex.jsonl!')\nassert a.holdout_violation([{'role':'user','content':'Другой контрольный объект'}])\nassert len([k for k in a.holdout_provenance() if not k.startswith('eval_prompts/')]) == 4`);
    expect(valid.stderr).toBe('');
    expect(valid.status).toBe(0);
  });

  it('accepts exactly 1024 full-template tokens intact and drops a 1025-token record with provenance', () => {
    const data = input({ train: [row('boundary', 1024), row('overflow', 1025)] });
    const original = fs.readFileSync(path.join(data, 'train.jsonl'), 'utf8').split('\n')[0];
    const out = path.join(home, 'prepared');
    const result = python(`report = p.prepare(pathlib.Path(${JSON.stringify(data)}), pathlib.Path(${JSON.stringify(out)}), tokenizer, identity, 1024)\nprint(json.dumps(report['stats']))`);
    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(out, 'train.jsonl'), 'utf8')).toBe(`${original}\n`);
    const stats = JSON.parse(result.stdout);
    expect(stats.train).toMatchObject({ accepted: 1, rejected: { overlength: 1 }, rejected_by_set: { constraints: 1 }, tokens_max: 1024, target_tokens_min: 1004 });
    expect(JSON.parse(fs.readFileSync(path.join(out, 'train.records.jsonl'), 'utf8')).key).toBe('train:0');
    expect(fs.readFileSync(path.join(data, 'train.jsonl'), 'utf8')).toContain('overflow');
    expect(python(`p.validate(pathlib.Path(${JSON.stringify(out)}), tokenizer, identity, 1024)`).status).toBe(0);
  });

  it('refuses changed prepared data and changed tokenizer identity rather than trusting old validation', () => {
    const data = input();
    const out = path.join(home, 'prepared');
    expect(python(`p.prepare(pathlib.Path(${JSON.stringify(data)}), pathlib.Path(${JSON.stringify(out)}), tokenizer, identity, 1024)`).status).toBe(0);
    expect(python(`p.validate(pathlib.Path(${JSON.stringify(out)}), tokenizer, {'model':'different'}, 1024)`).stderr).toContain('does not match');
    fs.appendFileSync(path.join(out, 'train.jsonl'), JSON.stringify(row('modified')) + '\n');
    expect(python(`p.validate(pathlib.Path(${JSON.stringify(out)}), tokenizer, identity, 1024)`).stderr).toContain('hash mismatch');
  });

  // Ревью #3267 (MEDIUM-6): build_mix.py переписывает свой каталог на месте — подготовленный снимок прежней сборки
  // проходил проверку и обучение шло на старых данных.
  it('refuses a prepared snapshot whose source data was rebuilt or removed after preparation', () => {
    const data = input();
    const out = path.join(home, 'prepared');
    const call = `p.validate(pathlib.Path(${JSON.stringify(out)}), tokenizer, identity, 1024)`;
    expect(python(`p.prepare(pathlib.Path(${JSON.stringify(data)}), pathlib.Path(${JSON.stringify(out)}), tokenizer, identity, 1024)`).status).toBe(0);
    expect(python(call).status).toBe(0);
    fs.appendFileSync(path.join(data, 'train.jsonl'), JSON.stringify(row('rebuilt')) + '\n');
    const stale = python(call);
    expect(stale.status).not.toBe(0);
    expect(stale.stderr).toContain('source data changed or is missing since preparation');
    expect(stale.stderr).toContain('train.jsonl');
    fs.rmSync(data, { recursive: true });
    expect(python(call).stderr).toContain('source data changed or is missing since preparation');
  });

  // Ревью #3267 (MEDIUM-5): подсказки срезов-навыков eval.py — это valid/test записи наборов; в train их быть не должно.
  it('keeps eval_prompts skill-slice questions out of the train split only, and hashes every slice', () => {
    const result = python([
      'slices = sorted(p.name for p in a.EVAL_PROMPTS.glob("*.jsonl"))',
      'provenance = a.holdout_provenance()',
      'assert [k for k in provenance if k.startswith("eval_prompts/")] == [f"eval_prompts/{name}" for name in slices], provenance',
      'assert {"offtopic.jsonl", "osm_intents.jsonl", "rag_answers.jsonl"} <= set(slices)',
      'cases = {name: [json.loads(line) for line in (a.EVAL_PROMPTS / f"{name}.jsonl").read_text().splitlines() if line.strip()] for name in a.SKILL_SLICES}',
      'for name, rows in cases.items():',
      ' for case in rows:',
      '  assert a.eval_slice_violation([{"role": "user", "content": case["prompt"]}]), (name, case["id"])',
      'question = cases["rag_answers"][0]["prompt"].split("Вопрос посетителя:")[-1]',
      'assert a.eval_slice_violation([{"role": "user", "content": "Материалы сайта: другие карточки\\nВопрос посетителя: " + question.upper()}])',
      'assert a.eval_slice_violation([{"role": "user", "content": "Независимый вопрос про павильон Зета"}]) is None',
      // срез site спрашивает знание, которому набор учит намеренно: только хеш
      'site = json.loads((a.EVAL_PROMPTS / "site.jsonl").read_text().splitlines()[0])',
      'assert a.eval_slice_violation([{"role": "user", "content": site["prompt"]}]) is None',
      'print(json.dumps({"question": question.strip()}))',
    ].join('\n'));
    expect(result.stderr).toBe('');
    const { question } = JSON.parse(result.stdout);
    const leak = { messages: [{ role: 'system', content: 'Fixture system' }, { role: 'user', content: `Материалы сайта: карточки\nВопрос посетителя: ${question}` }, { role: 'assistant', content: 'Complete target; TOKENS=64' }] };
    const prepare = (data: string, out: string) => python(`p.prepare(pathlib.Path(${JSON.stringify(data)}), pathlib.Path(${JSON.stringify(path.join(home, out))}), tokenizer, identity, 1024)`);
    // в valid та же запись законна — оттуда срез и взят
    const inValid = prepare(input({ valid: [leak] }), 'prepared-valid');
    expect(inValid.stderr).toBe('');
    fs.rmSync(path.join(home, 'input'), { recursive: true });
    const inTrain = prepare(input({ train: [leak] }), 'prepared-train');
    expect(inTrain.status).not.toBe(0);
    expect(inTrain.stderr).toContain('eval_prompts skill slice in the training split');
  });

  // Ревью #3267 (HIGH-1): v7 продолжает v4, обученную на 22 вопросах контура; проверка смотрела только данные кандидата.
  it('walks the resumed adapter line and requires an explicit acknowledgment of held-out reuse', () => {
    const contour = JSON.parse(fs.readFileSync(path.join(EVAL, 'cases.jsonl'), 'utf8').split('\n')[0]).q as string;
    const adapters = path.join(home, 'adapters');
    const write = (name: string, config: Record<string, unknown>, rows: ReturnType<typeof row>[] | null) => {
      fs.mkdirSync(path.join(adapters, name), { recursive: true });
      fs.writeFileSync(path.join(adapters, name, 'adapters.safetensors'), `weights of ${name}`);
      fs.writeFileSync(path.join(adapters, name, 'adapter_config.json'), JSON.stringify(config));
      if (rows) {
        fs.mkdirSync(path.join(home, 'data', name), { recursive: true });
        fs.writeFileSync(path.join(home, 'data', name, 'train.jsonl'), rows.map((value) => JSON.stringify(value)).join('\n') + '\n');
      }
    };
    const dirty = row('dirty');
    dirty.messages[1].content = `Материалы сайта: карточки\nВопрос посетителя: ${contour}`;
    write('first', { data: 'data/first' }, [row('clean-a'), dirty, dirty]);
    write('second', { data: 'data/second', resume_adapter_file: 'adapters/first/adapters.safetensors' }, [row('clean-b')]);
    const cfg = (extra: Record<string, unknown> = {}) => JSON.stringify({ resume_adapter_file: 'adapters/second/adapters.safetensors', ...extra });
    const run = (config: string) => python([
      `home = pathlib.Path(${JSON.stringify(home)})`,
      `cfg = json.loads(${JSON.stringify(config)})`,
      'print(json.dumps(p.check_lineage(home, cfg), ensure_ascii=False))',
    ].join('\n'));

    const refused = run(cfg());
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain('trained on held-out evaluation inputs');
    expect(refused.stderr).toContain('adapters/first/adapters.safetensors (data/first): 2 examples');
    expect(refused.stderr).toContain(contour);
    expect(refused.stderr).toContain('lineage_contamination_acknowledged: true');

    const acknowledged = run(cfg({ lineage_contamination_acknowledged: true }));
    expect(acknowledged.stderr).toBe('');
    const chain = JSON.parse(acknowledged.stdout);
    expect(chain.map((entry: { adapter: string }) => entry.adapter)).toEqual(['adapters/second/adapters.safetensors', 'adapters/first/adapters.safetensors']);
    expect(chain[0]).toMatchObject({ data: 'data/second', examples: 1, violations: 0, questions: [] });
    expect(chain[1]).toMatchObject({ data: 'data/first', examples: 3, violations: 2, reasons: { 'held-out evaluation question reused': 2 }, questions: [contour] });
    expect(chain[1].adapter_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(chain[1].train_sha256).toMatch(/^[0-9a-f]{64}$/);
    // строка "true" подтверждением не считается
    expect(run(cfg({ lineage_contamination_acknowledged: 'true' })).status).not.toBe(0);

    // чистая линия проходит без ключа; без данных предка линия непроверяема; resume_data называет их явно
    write('first', { data: 'data/first' }, [row('clean-a')]);
    expect(JSON.parse(run(cfg()).stdout)).toHaveLength(2);
    fs.rmSync(path.join(home, 'data', 'second'), { recursive: true });
    const unknown = run(cfg());
    expect(unknown.status).not.toBe(0);
    expect(unknown.stderr).toContain('training data of the resumed adapter is not available');
    fs.mkdirSync(path.join(home, 'data', 'moved'), { recursive: true });
    fs.writeFileSync(path.join(home, 'data', 'moved', 'train.jsonl'), JSON.stringify(row('clean-moved')) + '\n');
    expect(JSON.parse(run(cfg({ resume_data: 'data/moved' })).stdout)[0]).toMatchObject({ data: 'data/moved', violations: 0 });
    // без resume_adapter_file родословной нет
    expect(JSON.parse(python(`print(json.dumps(p.check_lineage(pathlib.Path(${JSON.stringify(home)}), {})))`).stdout)).toEqual([]);
  });

  it('stops a launch on an unacknowledged contaminated line and records the acknowledged one in resolved.json', () => {
    const contour = JSON.parse(fs.readFileSync(path.join(EVAL, 'cases.jsonl'), 'utf8').split('\n')[0]).q as string;
    const dirty = row('dirty');
    dirty.messages[1].content = contour;
    fs.mkdirSync(path.join(home, 'adapters', 'old'), { recursive: true });
    fs.writeFileSync(path.join(home, 'adapters', 'old', 'adapters.safetensors'), 'weights');
    fs.writeFileSync(path.join(home, 'adapters', 'old', 'adapter_config.json'), JSON.stringify({ data: 'data/old' }));
    fs.mkdirSync(path.join(home, 'data', 'old'), { recursive: true });
    fs.writeFileSync(path.join(home, 'data', 'old', 'train.jsonl'), JSON.stringify(dirty) + '\n');
    const launch = (run: string, acknowledged: boolean) => python([
      'import types',
      'sys.modules["yaml"] = types.SimpleNamespace(safe_load=json.loads)',
      `home = pathlib.Path(${JSON.stringify(home)})`,
      `config = home / "${run}.yaml"`,
      `config.write_text(json.dumps({"data": "prepared", "model": "model", "max_seq_length": 1024, "adapter_path": "adapters/${run}", "resume_adapter_file": "adapters/old/adapters.safetensors"${acknowledged ? ', "lineage_contamination_acknowledged": True' : ''}}))`,
      '(home / "prepared").mkdir(exist_ok=True)',
      'for name in ("stats", "manifest"): (home / "prepared" / f"{name}.json").write_text("{}")',
      'p.local_tokenizer = lambda model: (tokenizer, identity)',
      'p.validate = lambda *args: {}',
      'p.os.dup2 = lambda *args: None',
      'class CapturedExec(Exception): pass',
      'def capture_exec(python, args): raise CapturedExec()',
      'p.os.execv = capture_exec',
      'try:',
      ` p.launch(config, home, "${run}", [])`,
      'except CapturedExec: print("executed")',
      'except ValueError as error: print("refused:", error)',
    ].join('\n'));
    const refused = launch('line-refused', false);
    expect(refused.stdout).toContain('refused: the resumed adapter line was trained on held-out evaluation inputs');
    expect(fs.existsSync(path.join(home, 'logs', 'train-line-refused.resolved.json'))).toBe(false);
    const accepted = launch('line-accepted', true);
    expect(accepted.stderr).toBe('');
    expect(accepted.stdout).toContain('executed');
    const resolved = JSON.parse(fs.readFileSync(path.join(home, 'logs', 'train-line-accepted.resolved.json'), 'utf8'));
    expect(resolved.lineage_contamination_acknowledged).toBe(true);
    expect(resolved.lineage).toHaveLength(1);
    expect(resolved.lineage[0]).toMatchObject({ adapter: 'adapters/old/adapters.safetensors', data: 'data/old', violations: 1, questions: [contour] });
  });

  it.each(['empty', 'target', 'duplicate', 'group', 'metadata'])('rejects unusable or cross-split input: %s', (kind) => {
    const data = input(kind === 'empty' ? { valid: [row('too-long', 1025)] } : kind === 'target' ? { train: [row('no-target', 20)] } : {});
    if (kind === 'duplicate') {
      fs.copyFileSync(path.join(data, 'train.jsonl'), path.join(data, 'valid.jsonl'));
      fs.copyFileSync(path.join(data, 'train.records.jsonl'), path.join(data, 'valid.records.jsonl'));
    }
    if (kind === 'group' || kind === 'metadata') {
      const file = path.join(data, 'valid.records.jsonl');
      const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (kind === 'group') meta.key = 'train:0';
      else meta.messages[1].content = 'Unmatched metadata';
      fs.writeFileSync(file, JSON.stringify(meta) + '\n');
    }
    expect(python(`p.prepare(pathlib.Path(${JSON.stringify(data)}), pathlib.Path(${JSON.stringify(path.join(home, 'out'))}), tokenizer, identity, 1024)`).status).not.toBe(0);
  });

  it('requires an actual local tokenizer and prevents unvalidated command-line overrides', () => {
    expect(python(`p.local_tokenizer(pathlib.Path(${JSON.stringify(path.join(home, 'missing'))}))`).stderr).toContain('local model directory missing');
    for (const arg of ['--model=remote/model', '--data=other', '--max-seq-length=2048', '-cevil.yaml', '--mod=remote/model', '--max-seq=2048', '--train', '--help']) {
      const res = python(`p.launch(pathlib.Path('unused.yaml'), pathlib.Path(${JSON.stringify(home)}), 'probe', [${JSON.stringify(arg)}])`);
      expect(res.stderr).toContain('overrides must be validated');
    }
  });

  it('refuses a competing training lock and the OS releases it after its owner exits', () => {
    const lock = path.join(home, '.training.lock');
    const result = python([
      'import subprocess, fcntl',
      `lock = pathlib.Path(${JSON.stringify(lock)}).open('a+')`,
      'fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)',
      `config = pathlib.Path(${JSON.stringify(path.join(home, 'probe.yaml'))})`,
      'config.write_text("{}")',
      'p.load_config = lambda *args: ({}, pathlib.Path("unused"), pathlib.Path("unused"), 1024)',
      'try:',
      ` p.launch(config, pathlib.Path(${JSON.stringify(home)}), 'probe', [])`,
      'except ValueError as error:',
      ' assert "another training owns" in str(error)',
      'else: raise AssertionError("lock did not block")',
    ].join('\n'));
    expect(result.status).toBe(0);
    expect(python(`lock = pathlib.Path(${JSON.stringify(lock)}).open('a+')\nimport fcntl\nfcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)`).status).toBe(0);
  });

  it('executes the exact config bytes audited before a concurrent source-config edit', () => {
    const result = python([
      'import types',
      'sys.modules["yaml"] = types.SimpleNamespace(safe_load=json.loads)',
      `home = pathlib.Path(${JSON.stringify(home)})`,
      'config = home / "candidate.yaml"',
      'original = json.dumps({"data":"prepared", "model":"model", "max_seq_length":1024, "adapter_path":"adapters/new"}).encode()',
      'config.write_bytes(original)',
      '(home / "prepared").mkdir()',
      'for name in ("stats", "manifest"): (home / "prepared" / f"{name}.json").write_text("{}")',
      'p.local_tokenizer = lambda model: (tokenizer, identity)',
      'def validate_and_edit(*args):',
      ' config.write_text(json.dumps({"data":"UNVALIDATED", "model":"OTHER", "max_seq_length":2048}))',
      ' return {}',
      'p.validate = validate_and_edit',
      'p.os.dup2 = lambda *args: None',
      'class CapturedExec(Exception): pass',
      'def capture_exec(python, args):',
      ' snapshot = pathlib.Path(args[args.index("-c") + 1])',
      ' assert snapshot.read_bytes() == original',
      ' assert config.read_bytes() != original',
      ' assert json.loads(snapshot.read_bytes())["data"] == "prepared"',
      ' raise CapturedExec()',
      'p.os.execv = capture_exec',
      'try:',
      ' p.launch(config, home, "config-race", [])',
      'except CapturedExec: pass',
      'else: raise AssertionError("trainer was not executed")',
    ].join('\n'));
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
