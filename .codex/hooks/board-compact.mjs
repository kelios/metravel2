#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { main } from '../../.claude/hooks/board-compact.mjs';
export * from '../../.claude/hooks/board-compact.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
