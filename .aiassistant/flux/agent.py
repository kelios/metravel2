"""Narrow ACP chat agent: local Qwen chooses the existing offline FLUX tool."""
import asyncio
import json
import re
from uuid import uuid4

import httpx
from acp import Agent, PROTOCOL_VERSION, InitializeResponse, NewSessionResponse, PromptResponse, run_agent
from acp.schema import AgentMessageChunk, ImageContentBlock, Implementation, TextContentBlock

from server import SERVER, generate_flux_image, run_with_shutdown

ENDPOINT = 'http://127.0.0.1:18088/v1/chat/completions'
SYSTEM = """You are a local image assistant inside PhpStorm. Respond in the user's language.
For an explicit request to GENERATE an image, compose a detailed English visual prompt
and call generate_flux_image exactly once using the normal tool-call interface.
Use defaults unless the user specifies dimensions or seed. Never claim an image exists
without the tool result. For ordinary questions, reply briefly without calling tools.
You have no repository, shell, filesystem-reading, publishing or other MCP capabilities.
Do not pretend to perform code edits, tests, uploads or publications. Existing images
cannot be edited with this tool. Ask for clarification if a generation request is unclear.
"""


class FluxAgent(Agent):
    def __init__(self):
        self.sessions = {}
        self.active = {}
        self.conn = None

    def on_connect(self, conn):
        self.conn = conn

    async def initialize(self, protocol_version, client_capabilities=None, client_info=None, **kwargs):
        return InitializeResponse(protocol_version=PROTOCOL_VERSION,
            agent_info=Implementation(name='qwen-local-flux', title='Qwen + local FLUX', version='1.0.0'))

    async def new_session(self, cwd, mcp_servers=None, **kwargs):
        session_id = uuid4().hex
        self.sessions[session_id] = []
        return NewSessionResponse(session_id=session_id)

    async def send(self, session_id, content):
        await self.conn.session_update(session_id=session_id, update=AgentMessageChunk(content=content))

    async def text(self, session_id, text):
        await self.send(session_id, TextContentBlock(text=text))

    async def model(self, messages, tools):
        # Explicit render commands must return a real tool call, never a prose claim.
        request = messages[-1]['content']
        imperative = re.search(r'(?i)^\s*(?:пожалуйста[,\s]+)?(?:сгенерируй(?:те)?|нарисуй(?:те)?|создай(?:те)?|generate|draw|render|create)\b', request)
        visual = re.search(r'(?i)картин|изображ|иллюстрац|обложк|фотограф|рисунок|\b(?:image|picture|photo|illustration|cover)\b', request)
        draw = re.search(r'(?i)^\s*(?:пожалуйста[,\s]+)?(?:нарисуй(?:те)?|draw|render)\b', request)
        text_object = re.search(r'(?i)\b(?:промпт\w*|текст\w*|описан\w*|инструкц\w*|код(?:а|у|ом|е|ы|ов)?|prompts?|text|description|code)\b', request)
        # The requested object precedes modifiers such as 'for an image'.
        # Preserve prompt/code requests even with articles, 'ещё один', or language names.
        first_draw_object_is_text = bool(draw and text_object and re.fullmatch(
            r'(?i)\s*(?:(?:мне|a|an|the)\s+)*', request[draw.end():text_object.start()]))
        prompt_only = bool(text_object and ((visual and text_object.start() < visual.start())
                                           or first_draw_object_is_text))
        explicit_image = bool((draw or (imperative and visual)) and not prompt_only)
        async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=10), trust_env=False) as client:
            response = await client.post(ENDPOINT, json={
                'model': 'metravel-local', 'messages': messages, 'tools': tools,
                'tool_choice': {'type': 'function', 'function': {'name': 'generate_flux_image'}} if explicit_image else 'auto', 'temperature': 0.3, 'max_tokens': 512,
                'chat_template_kwargs': {'enable_thinking': False},
            })
            response.raise_for_status()
            return response.json()['choices'][0]['message']

    async def prompt(self, session_id, prompt, **kwargs):
        if session_id not in self.sessions:
            raise ValueError('Unknown session; create a new session first.')
        if session_id in self.active:
            raise ValueError('This session already has an active request.')
        text_blocks = [block.text for block in prompt if isinstance(block, TextContentBlock)]
        text = '\n'.join(text_blocks).strip()
        if not text or len(text) > 12000:
            await self.text(session_id, 'Нужен текстовый запрос до 12 000 символов. Этот агент создаёт картинки локальной FLUX.')
            return PromptResponse(stop_reason='end_turn')
        task = asyncio.current_task()
        self.active[session_id] = task
        history = self.sessions[session_id]
        # Keep only complete turns; no images or tool metadata accumulate in history.
        while history and (len(history) > 6 or sum(len(x['content']) for x in history) > 12000):
            del history[:2]
        try:
            await self.text(session_id, 'Qwen готовит ответ и при необходимости промпт для локальной FLUX…\n')
            definitions = await SERVER.list_tools()
            tools = [{'type': 'function', 'function': {'name': t.name,
                'description': t.description, 'parameters': t.inputSchema}}
                for t in definitions if t.name == 'generate_flux_image']
            message = await self.model([{'role': 'system', 'content': SYSTEM}, *history,
                {'role': 'user', 'content': text}], tools)
            calls = message.get('tool_calls') or []
            if not calls:
                answer = message.get('content') or 'Qwen не вернула ответ. Попробуйте уточнить запрос.'
                await self.text(session_id, answer + '\n\nFLUX в этом ответе не запускалась.')
                history.extend([{'role': 'user', 'content': text}, {'role': 'assistant', 'content': answer[:4000]}])
            else:
                if len(calls) != 1 or calls[0].get('function', {}).get('name') != 'generate_flux_image':
                    raise ValueError('Qwen must select exactly one generate_flux_image call.')
                args = json.loads(calls[0]['function']['arguments'])
                if not isinstance(args, dict) or set(args) - {'prompt', 'width', 'height', 'seed'}:
                    raise ValueError('Qwen returned invalid FLUX arguments.')
                await self.text(session_id, 'Запускаю локальную FLUX. Обычно это занимает 15–90 секунд.\n')
                # Reuse the reviewed tool's validation, lock, offline paths and cancellation.
                result = await generate_flux_image(**args)
                for item in result:
                    if isinstance(item, str):
                        await self.text(session_id, item + '\n')
                    else:
                        image = item.to_image_content()
                        await self.send(session_id, ImageContentBlock(data=image.data, mime_type=image.mimeType))
                        if item.path is not None:
                            await self.text(session_id, f'\n[Открыть PNG]({item.path.as_uri()})\n')
                history.extend([{'role': 'user', 'content': text},
                    {'role': 'assistant', 'content': 'Создан локальный PNG по предыдущему запросу; новый запрос требует нового вызова инструмента.'}])
            return PromptResponse(stop_reason='end_turn')
        except asyncio.CancelledError:
            await self.text(session_id, 'Запрос отменён. Незавершённая генерация остановлена.')
            return PromptResponse(stop_reason='cancelled')
        except Exception as exc:
            await self.text(session_id, f'Не удалось завершить запрос: {type(exc).__name__}: {exc}\nУспешный результат не подтверждён.')
            return PromptResponse(stop_reason='end_turn')
        finally:
            self.active.pop(session_id, None)

    async def cancel(self, session_id, **kwargs):
        task = self.active.get(session_id)
        if task is not None:
            task.cancel()


if __name__ == '__main__':
    asyncio.run(run_with_shutdown(run_agent(FluxAgent())))
