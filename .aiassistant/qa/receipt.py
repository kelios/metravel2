"""Mechanical evidence inventory, deliberately not a judge of UI/UX correctness."""
import json
from pathlib import Path
import re
from urllib.parse import parse_qsl, unquote, urlsplit


def url_key(value):
    if not isinstance(value, str):
        return None
    try:
        url = urlsplit(value)
        return (url.scheme.lower(), url.netloc.lower(), unquote(url.path),
                tuple(sorted(parse_qsl(url.query, keep_blank_values=True))), unquote(url.fragment))
    except (TypeError, ValueError):
        return None


class EvidenceInventory:
    def __init__(self):
        self.steps = 0
        self.tools = []
        self.visited_urls = []
        self.image_attachments = 0
        self.image_read_requests = []
        self.image_inputs_from_read = []
        self.budget_stop = None
        self.last_finish = None
        self.last_finish_message = None
        self.texts = {}
        self.reported_tokens = {'input': 0, 'output': 0, 'cache_read': 0, 'cache_write': 0}
        self.stream_errors = 0

    def observe(self, line):
        try:
            event = json.loads(line)
        except (ValueError, TypeError):
            return
        if not isinstance(event, dict):
            return
        kind = event.get('type')
        part = event.get('part') or {}
        if not isinstance(part, dict):
            return
        if kind == 'step_start':
            self.steps += 1
        elif kind == 'error':
            self.stream_errors += 1
        elif kind == 'budget_stop':
            self.budget_stop = event.get('reason', 'unknown')
        elif kind == 'step_finish':
            self.last_finish = part.get('reason')
            self.last_finish_message = part.get('messageID')
            tokens = part.get('tokens') or {}
            cache = tokens.get('cache') or {}
            for name, value in (('input', tokens.get('input')), ('output', tokens.get('output')),
                                ('cache_read', cache.get('read')), ('cache_write', cache.get('write'))):
                if isinstance(value, (int, float)):
                    self.reported_tokens[name] += value
        elif kind == 'text':
            message = part.get('messageID')
            self.texts[message] = self.texts.get(message, '') + str(part.get('text', ''))
        elif kind == 'tool_use':
            state = part.get('state') or {}
            if not isinstance(state, dict):
                return
            output = str(state.get('output', ''))
            tool = part.get('tool', '')
            error = state.get('status') == 'error' or output.startswith('### Error')
            self.tools.append({'name': tool, 'call_id': part.get('callID'), 'error': error})
            succeeded = state.get('status') == 'completed' and not error
            if succeeded:
                for value in re.findall(r'^- Page URL: (\S+)', output, re.MULTILINE):
                    if value not in self.visited_urls:
                        self.visited_urls.append(value)
            attachments = [*(part.get('attachments') or []), *(state.get('attachments') or [])]
            image_count = sum(
                isinstance(value, dict) and str(value.get('mime', value.get('mimeType', ''))).startswith('image/')
                for value in attachments)
            self.image_attachments += image_count
            arguments = state.get('input') or {}
            image_path = arguments.get('filePath', '') if isinstance(arguments, dict) else ''
            if succeeded and tool == 'read' and Path(image_path).suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'):
                self.image_read_requests.append(image_path)
                if image_count:
                    self.image_inputs_from_read.append(image_path)

    def finish(self, output, runtime_code):
        output = Path(output).resolve()
        final_text = self.texts.get(self.last_finish_message, '')
        warnings = []
        if self.last_finish != 'stop' or not final_text.strip():
            warnings.append('missing_complete_final_response')
        report = None
        text = final_text.strip()
        if text.startswith('```json') and text.endswith('```'):
            text = text[7:-3].strip()
        try:
            report = json.loads(text)
        except (ValueError, TypeError):
            warnings.append('final_response_is_not_report_json')
        observed = {key for value in self.visited_urls if (key := url_key(value)) is not None}
        image_inputs = {Path(value).resolve() for value in self.image_inputs_from_read}
        if isinstance(report, dict):
            for key in ('suspicions', 'not_tested', 'images_received'):
                if not isinstance(report.get(key), list):
                    warnings.append(f'invalid_{key}')
            if not isinstance(report.get('next_pass'), str) or not report['next_pass'].strip():
                warnings.append('invalid_next_pass')
        if not isinstance(report, dict) or not isinstance(report.get('cases'), list) or not report['cases']:
            warnings.append('missing_cases')
        else:
            for index, case in enumerate(report['cases']):
                if not isinstance(case, dict) or case.get('status') not in ('PASS', 'FAIL', 'NOT_TESTED'):
                    warnings.append(f'case_{index}:invalid_status')
                    continue
                if not isinstance(case.get('name'), str) or not case['name'].strip():
                    warnings.append(f'case_{index}:missing_name')
                if case.get('kind') not in ('functional', 'visual'):
                    warnings.append(f'case_{index}:invalid_kind')
                completed = case['status'] != 'NOT_TESTED'
                actions = case.get('actions')
                if (not isinstance(actions, list) or (completed and not actions) or
                        any(not isinstance(value, str) or not value.strip() for value in actions) or
                        any(not isinstance(case.get(key), str) or not case[key].strip() for key in ('expected', 'actual'))):
                    warnings.append(f'case_{index}:missing_observation')
                if not isinstance(case.get('observed_url'), str):
                    warnings.append(f'case_{index}:invalid_observed_url')
                elif completed and url_key(case['observed_url']) not in observed:
                    warnings.append(f'case_{index}:url_not_observed_by_browser')
                files = case.get('evidence_files')
                if not isinstance(files, list) or (completed and not files):
                    warnings.append(f'case_{index}:missing_evidence_files')
                    continue
                visual_input = False
                for value in files:
                    if not isinstance(value, str):
                        warnings.append(f'case_{index}:invalid_evidence_path')
                        continue
                    try:
                        file = Path(value)
                        file = (file if file.is_absolute() else output / file).resolve()
                        exists = file.is_file()
                    except (OSError, ValueError, RuntimeError):
                        warnings.append(f'case_{index}:invalid_evidence_path')
                        continue
                    try:
                        file.relative_to(output)
                    except ValueError:
                        warnings.append(f'case_{index}:evidence_outside_batch')
                        continue
                    if not exists:
                        warnings.append(f'case_{index}:evidence_file_missing')
                    elif file.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp') and file in image_inputs:
                        visual_input = True
                if completed and case.get('kind') == 'visual' and not visual_input:
                    warnings.append(f'case_{index}:visual_input_not_established')
        if self.budget_stop:
            completion = 'budget_stop'
        elif runtime_code or self.stream_errors:
            completion = 'runtime_error'
        elif self.last_finish == 'length':
            completion = 'incomplete_length'
        elif warnings:
            completion = 'incomplete_report'
        else:
            completion = 'report_ready_for_review'
        return {
            'runtime_exit_code': runtime_code, 'completion': completion, 'site_verdict': 'NOT_EVALUATED',
            'stream_errors': self.stream_errors,
            'teacher_review_required': True, 'steps': self.steps, 'tools': self.tools,
            'visited_urls': self.visited_urls, 'budget_stop': self.budget_stop,
            'last_finish_reason': self.last_finish, 'mechanical_warnings': warnings,
            'reported_local_token_usage': self.reported_tokens,
            'vision': {'image_attachments_in_events': self.image_attachments,
                       'image_read_requests': self.image_read_requests,
                       'image_inputs_from_read': self.image_inputs_from_read,
                       'provider_delivery': 'not_verified_by_this_receipt'},
            'report': report,
        }, final_text


class EventTee:
    def __init__(self, destination, terminal, inventory):
        self.destination, self.terminal, self.inventory = destination, terminal, inventory
        self.pending = ''

    def write(self, value):
        self.destination.write(value)
        self.terminal.write(value)
        self.pending += value
        while '\n' in self.pending:
            line, self.pending = self.pending.split('\n', 1)
            self.inventory.observe(line)
        return len(value)

    def flush(self):
        self.destination.flush()
        self.terminal.flush()
