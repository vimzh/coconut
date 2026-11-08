"""Recompute the pilot's classification metrics and request accounting without importing its scorer."""
import hashlib
import json
from collections import Counter
from datetime import datetime
from fractions import Fraction
from pathlib import Path

source = Path('apps/api/data/private/deep-pair-v1/result.json')
raw = source.read_bytes()
data = json.loads(raw)
suite = json.loads(Path('apps/api/data/research/deep-pair-population-v1.json').read_text())
labels = {case['id']: case['label'] for case in suite['cases']}
names = ('convex', 'concave', 'neither')
assert len(data['rows']) == 36
assert len({(r['modelId'], r['caseId'], r['trialIndex']) for r in data['rows']}) == 36
assert all(r['result'] is not None and r['result']['failure'] is None for r in data['rows'])
assert sum(r['result']['inferenceRequests'] for r in data['rows']) == data['inferenceRequests'] == 36
assert len(list(source.parent.glob('dispatch-*.json'))) == 36
progress = json.loads(Path('apps/api/data/experiments/deep-pair-progress-v1.json').read_text())
assert progress['state'] == 'settled' and progress['unknownRemoteInferenceRequests'] == 0
assert progress['inferenceRequests'] == 36 and progress['cumulativeConservativeRequests'] == 8160
assert data['cumulativeConservativeRequests'] == 8160
assert len(progress['rows']) == 36 and all(r['dispatched'] and r['failure'] is None for r in progress['rows'])
assert {(r['modelId'], r['caseId'], r['depth'], r['trialIndex']) for r in progress['rows']} == {(r['modelId'], r['caseId'], r['depth'], r['trialIndex']) for r in data['rows']}
summaries = []
for retained in data['reports']:
    model = retained['modelId']
    rows = [r for r in data['rows'] if r['modelId'] == model and r['depth'] == retained['depth']]
    assert len(rows) == 9
    matrix = {label: Counter() for label in names}
    outcomes = Counter()
    for row in rows:
        outcome = row['result']['evidence']['outcome']
        reference = labels[row['caseId']]
        outcomes[outcome['kind']] += 1
        if outcome['kind'] == 'answer':
            parsed = json.loads(outcome['rawText'])
            assert set(parsed) == {'label', 'explanation'}
            assert parsed['label'] == outcome['label'] and parsed['explanation'] == outcome['explanation']
            matrix[reference][outcome['label']] += 1
        else:
            assert outcome['kind'] == 'invalid'
            try:
                json.loads(outcome['rawText'])
            except json.JSONDecodeError:
                pass
            else:
                raise AssertionError('Expected independently confirmed malformed JSON')
            matrix[reference]['unusable'] += 1
    correct = sum(matrix[label][label] for label in names)
    f1 = {}
    for label in names:
        tp = matrix[label][label]
        fp = sum(matrix[other][label] for other in names if other != label)
        fn = sum(matrix[label].values()) - tp
        f1[label] = Fraction(2 * tp, 2 * tp + fp + fn)
    macro = sum(f1.values(), Fraction()) / 3
    report = retained['report']['overall']['classification']
    assert report['population']['correctTrials'] == correct
    assert report['population']['plannedTrials'] == 9 and report['population']['includedTrials'] == 9
    assert abs(report['macroF1'] - float(macro)) < 1e-14
    assert abs(report['accuracy']['value'] - correct / 9) < 1e-14
    for label in names:
        expected = {key: matrix[label][key] for key in (*names, 'unusable')}
        assert report['confusion']['rows'][label]['counts'] == expected
    usage = {field: sum(r['result']['evidence']['usage'][field]['count'] for r in rows) for field in ('input', 'output')}
    rates = ('0.40', '1.60') if model == 'gpt-4.1-mini' else ('0.15', '0.60')
    estimated = (usage['input'] * Fraction(rates[0]) + usage['output'] * Fraction(rates[1])) / 1000000
    summaries.append({'modelId': model, 'depth': retained['depth'], 'reportedModelIds': sorted({r['result']['reportedModelId'] for r in rows}),
                      'correct': correct, 'planned': 9, 'wrongValid': outcomes['answer'] - correct,
                      'invalid': outcomes['invalid'], 'macroF1': float(macro), 'macroF1Exact': str(macro),
                      'confusion': {label: {key: matrix[label][key] for key in (*names, 'unusable')} for label in names},
                      'usage': usage, 'estimatedUsdIgnoringCacheDiscounts': float(estimated)})
started = min(r['result']['startedAt'] for r in data['rows'])
finished = max(r['result']['finishedAt'] for r in data['rows'])
span = (datetime.fromisoformat(finished.replace('Z', '+00:00')) - datetime.fromisoformat(started.replace('Z', '+00:00'))).total_seconds()
print(json.dumps({'sourceFileSha256': hashlib.sha256(raw).hexdigest(), 'verdict': 'pass',
                  'inferenceRequests': 36, 'cumulativeConservativeRequests': 8124 + 36,
                  'concurrency': data['concurrency'], 'trialSpanSeconds': span, 'models': summaries,
                  'limits': 'Fixed six-task descriptive pilot (three per depth); estimates are not provider bills. Private source exports are required for arithmetic replay.'}, indent=2))
