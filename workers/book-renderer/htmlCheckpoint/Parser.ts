import { TagStack, type TagStore } from '@/workers/book-renderer/htmlCheckpoint/tagStackStore';
import type { PendingText, SemanticPending } from '@/workers/book-renderer/htmlCheckpoint/semanticState';
import { HTML_PORT_UPSTREAM_PIN } from '@/workers/book-renderer/htmlCheckpoint/protocol';
// Derived from htmlparser2 10.1.0; see LICENSE-htmlparser2 and UPSTREAM.json.
import Tokenizer from "@/workers/book-renderer/htmlCheckpoint/Tokenizer";
import { type Callbacks, QuoteType } from "@/workers/book-renderer/htmlCheckpoint/lexicalDefinitions";
import { fromCodePoint } from "@/workers/book-renderer/htmlCheckpoint/entities/codepoint";
import { ForeignContext, type ContextStore } from "@/workers/book-renderer/htmlCheckpoint/contextStore";
import { SourceText, type TextStore } from "@/workers/book-renderer/htmlCheckpoint/sourceText";
import { htmlDecodeTree } from "@/workers/book-renderer/htmlCheckpoint/entities/htmlDecodeTree";
import { xmlDecodeTree } from "@/workers/book-renderer/htmlCheckpoint/entities/xmlDecodeTree";
import { limits as validateLimits, validateParserCheckpoint, type ParserCheckpoint, type CheckpointLimits } from "@/workers/book-renderer/htmlCheckpoint/state";

const formTags = new Set([
    "input",
    "option",
    "optgroup",
    "select",
    "button",
    "datalist",
    "textarea",
]);
const pTag = new Set(["p"]);
const tableSectionTags = new Set(["thead", "tbody"]);
const ddtTags = new Set(["dd", "dt"]);
const rtpTags = new Set(["rt", "rp"]);

const openImpliesClose = new Map<string, Set<string>>([
    ["tr", new Set(["tr", "th", "td"])],
    ["th", new Set(["th"])],
    ["td", new Set(["thead", "th", "td"])],
    ["body", new Set(["head", "link", "script"])],
    ["li", new Set(["li"])],
    ["p", pTag],
    ["h1", pTag],
    ["h2", pTag],
    ["h3", pTag],
    ["h4", pTag],
    ["h5", pTag],
    ["h6", pTag],
    ["select", formTags],
    ["input", formTags],
    ["output", formTags],
    ["button", formTags],
    ["datalist", formTags],
    ["textarea", formTags],
    ["option", new Set(["option"])],
    ["optgroup", new Set(["optgroup", "option"])],
    ["dd", ddtTags],
    ["dt", ddtTags],
    ["address", pTag],
    ["article", pTag],
    ["aside", pTag],
    ["blockquote", pTag],
    ["details", pTag],
    ["div", pTag],
    ["dl", pTag],
    ["fieldset", pTag],
    ["figcaption", pTag],
    ["figure", pTag],
    ["footer", pTag],
    ["form", pTag],
    ["header", pTag],
    ["hr", pTag],
    ["main", pTag],
    ["nav", pTag],
    ["ol", pTag],
    ["pre", pTag],
    ["section", pTag],
    ["table", pTag],
    ["ul", pTag],
    ["rt", rtpTags],
    ["rp", rtpTags],
    ["tbody", tableSectionTags],
    ["tfoot", tableSectionTags],
]);

const voidElements = new Set([
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

const foreignContextElements = new Set(["math", "svg"]);

const htmlIntegrationElements = new Set([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "annotation-xml",
    "foreignobject",
    "desc",
    "title",
]);

export interface ParserOptions {
    /** Bounded consumer backpressure; runtime callback is pinned by the artifact. */
    yieldText?: () => boolean;
    /** Worker-only callback subdivision uses immutable source ranges and bounded text batches. */
    boundedTextCallbacks?: boolean;
    /**
     * Indicates whether special tags (`<script>`, `<style>`, and `<title>`) should get special treatment
     * and if "empty" tags (eg. `<br>`) can have children.  If `false`, the content of special tags
     * will be text only. For feeds and other XML content (documents that don't consist of HTML),
     * set this to `true`.
     *
     * @default false
     */
    xmlMode?: boolean;

    /**
     * Decode entities within the document.
     *
     * @default true
     */
    decodeEntities?: boolean;

    /**
     * If set to true, all tags will be lowercased.
     *
     * @default !xmlMode
     */
    lowerCaseTags?: boolean;

    /**
     * If set to `true`, all attribute names will be lowercased. This has noticeable impact on speed.
     *
     * @default !xmlMode
     */
    lowerCaseAttributeNames?: boolean;

    /**
     * If set to true, CDATA sections will be recognized as text even if the xmlMode option is not enabled.
     * NOTE: If xmlMode is set to `true` then CDATA sections will always be recognized as text.
     *
     * @default xmlMode
     */
    recognizeCDATA?: boolean;

    /**
     * If set to `true`, self-closing tags will trigger the onclosetag event even if xmlMode is not set to `true`.
     * NOTE: If xmlMode is set to `true` then self-closing tags will always be recognized.
     *
     * @default xmlMode
     */
    recognizeSelfClosing?: boolean;

    /**
     * Allows the default tokenizer to be overwritten.
     */
    Tokenizer?: typeof Tokenizer;
}

export interface Handler {
    onparserinit(parser: Parser): void;

    /**
     * Resets the handler back to starting state
     */
    onreset(): void;

    /**
     * Signals the handler that parsing is done
     */
    onend(): void;
    onerror(error: Error): void;
    onclosetag(name: string, isImplied: boolean): void;
    onopentagname(name: string): void;
    /**
     *
     * @param name Name of the attribute
     * @param value Value of the attribute.
     * @param quote Quotes used around the attribute. `null` if the attribute has no quotes around the value, `undefined` if the attribute has no value.
     */
    onattribute(
        name: string,
        value: string,
        quote?: string | undefined | null,
    ): void;
    onopentag(
        name: string,
        attribs: { [s: string]: string },
        isImplied: boolean,
    ): void;
    ontext(data: string): void;
    oncomment(data: string): void;
    oncdatastart(): void;
    oncdataend(): void;
    oncommentend(): void;
    onprocessinginstruction(name: string, data: string): void;
}

const reNameEnd = /\s|\//;

export class Parser implements Callbacks {
    /** The start index of the last event. */
    public startIndex = 0;
    /** The end index of the last event. */
    public endIndex = 0;
    /**
     * Store the start index of the current open tag,
     * so we can update the start index for attributes.
     */
    private openTagStart = 0;

    private tagname = "";
    private attribname = "";
    private attribvalue = "";
    private attribs: null | { [key: string]: string } = null;
    private readonly stack: TagStack;
    private pending: SemanticPending | null = null;
    private textQueue: PendingText[] = [];
    private completed = false;
    /** Determines whether self-closing tags are recognized. */
    private readonly foreignContext: ForeignContext;
    private readonly cbs: Partial<Handler>;
    private readonly lowerCaseTagNames: boolean;
    private readonly lowerCaseAttributeNames: boolean;
    private readonly recognizeSelfClosing: boolean;
    /** We are parsing HTML. Inverse of the `xmlMode` option. */
    private readonly htmlMode: boolean;
    private readonly tokenizer: Tokenizer;

    private readonly sourceText: SourceText;
    /** Indicates whether the parser has finished running / `.end` has been called. */
    private ended = false;

    constructor(
        cbs: Partial<Handler> | null | undefined,
        private readonly options: ParserOptions = {},
        private readonly stores: {context: ContextStore; text: TextStore; tags: TagStore},
        private readonly limits: CheckpointLimits,
    ) {
        this.limits = validateLimits(limits);
        if (options.boundedTextCallbacks && (options.xmlMode || options.recognizeCDATA)) throw new Error('HTML_CHECKPOINT_TEXT_POLICY_INVALID');
        if (options.Tokenizer) throw new Error("HTML_CHECKPOINT_CUSTOM_TOKENIZER");
        this.cbs = cbs ?? {};
        this.htmlMode = !this.options.xmlMode;
        this.lowerCaseTagNames = options.lowerCaseTags ?? this.htmlMode;
        this.lowerCaseAttributeNames =
            options.lowerCaseAttributeNames ?? this.htmlMode;
        this.recognizeSelfClosing =
            options.recognizeSelfClosing ?? !this.htmlMode;
        this.tokenizer = new (options.Tokenizer ?? Tokenizer)(
            {...this.options, maxCarryChars: this.limits.maxCarryChars},
            this,
        );
        this.stack = new TagStack(stores.tags, limits.maxCarryChars);
        this.foreignContext = new ForeignContext(stores.context);
        this.foreignContext.unshift(!this.htmlMode);
        this.sourceText = new SourceText(stores.text, limits.maxCarryChars);
        this.cbs.onparserinit?.(this);
    }

    /** Save only between completed bounded feeds, never from inside a callback. */
    save(): ParserCheckpoint {
        return validateParserCheckpoint({version: 1, upstreamPin: HTML_PORT_UPSTREAM_PIN, limits: this.limits,
            options: {xmlMode: !this.htmlMode, decodeEntities: this.options.decodeEntities ?? true,
                lowerCaseTags: this.lowerCaseTagNames, lowerCaseAttributeNames: this.lowerCaseAttributeNames,
                recognizeSelfClosing: this.recognizeSelfClosing, recognizeCDATA: this.options.recognizeCDATA ?? false, boundedTextCallbacks: this.options.boundedTextCallbacks ?? false},
            startIndex: this.startIndex, endIndex: this.endIndex, openTagStart: this.openTagStart,
            tagname: this.tagname, attribname: this.attribname, attribvalue: this.attribvalue,
            attribs: this.attribs, stack: this.stack.save(), ended: this.ended, pending: this.pending, textQueue: this.textQueue, completed: this.completed,
            foreignContext: this.foreignContext.save(), sourceText: this.sourceText.save(),
            tokenizer: this.tokenizer.save()}, this.htmlMode ? htmlDecodeTree.length : xmlDecodeTree.length);
    }

    restore(value: unknown): void {
        const state = validateParserCheckpoint(value, this.htmlMode ? htmlDecodeTree.length : xmlDecodeTree.length);
        const own = this.save();
        if (JSON.stringify(state.limits) !== JSON.stringify(own.limits) || JSON.stringify(state.options) !== JSON.stringify(own.options)) {
            throw new Error('HTML_CHECKPOINT_POLICY_MISMATCH');
        }
        this.startIndex = state.startIndex; this.endIndex = state.endIndex; this.openTagStart = state.openTagStart;
        this.tagname = state.tagname; this.attribname = state.attribname; this.attribvalue = state.attribvalue;
        this.attribs = state.attribs; this.stack.restore(state.stack); this.pending = state.pending; this.textQueue = state.textQueue; this.completed = state.completed;
        this.ended = state.ended; this.foreignContext.restore(state.foreignContext);
        this.sourceText.restore(state.sourceText); this.tokenizer.restore(state.tokenizer, this.limits.maxInputChars);
    }

    // Tokenizer event handlers

    /** @internal */
    ontext(start: number, endIndex: number): void {
        this.endIndex = endIndex - 1;
        if (this.options.boundedTextCallbacks) {
            if (start < endIndex) this.enqueueText({kind: 'source', start, end: endIndex, eventStartIndex: this.startIndex, eventEndIndex: this.endIndex});
        } else this.cbs.ontext?.(this.getSlice(start, endIndex));
        this.startIndex = endIndex;
    }

    /** @internal */
    ontextentity(cp: number, endIndex: number): void {
        this.endIndex = endIndex - 1;
        if (this.options.boundedTextCallbacks) this.enqueueText({kind: 'literal', value: fromCodePoint(cp), eventStartIndex: this.startIndex, eventEndIndex: this.endIndex});
        else this.cbs.ontext?.(fromCodePoint(cp));
        this.startIndex = endIndex;
    }

    /**
     * Checks if the current tag is a void element. Override this if you want
     * to specify your own additional void elements.
     */
    protected isVoidElement(name: string): boolean {
        return this.htmlMode && voidElements.has(name);
    }

    /** @internal */
    onopentagname(start: number, endIndex: number): void {
        this.endIndex = endIndex;

        let name = this.getSlice(start, endIndex);

        if (this.lowerCaseTagNames) {
            name = name.toLowerCase();
        }

        this.emitOpenTag(name);
    }

    private emitOpenTag(name: string): void {
        this.openTagStart = this.startIndex;
        this.tagname = name;
        this.pending = {kind: 'open', name, tokenEnd: null}; this.tokenizer.pause();
    }

    private endOpenTag(isImplied: boolean) {
        this.startIndex = this.openTagStart;

        if (this.attribs) {
            this.cbs.onopentag?.(this.tagname, this.attribs, isImplied);
            this.attribs = null;
        }
        if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
            this.cbs.onclosetag(this.tagname, true);
        }

        this.tagname = "";
    }

    /** @internal */
    onopentagend(endIndex: number): void {
        this.endIndex = endIndex;
        // The tokenizer reconsumes the opening-name delimiter in the same
        // character transition, even when onopentagname pauses it. Defer its
        // closing `>` callback until implied closes, stack push and attrs init
        // have completed; the tokenizer still finishes its own local state.
        if (this.pending?.kind === 'open') {
            this.pending.tokenEnd = endIndex;
            return;
        }
        this.endOpenTag(false);

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /** @internal */
    onclosetag(start: number, endIndex: number): void {
        this.endIndex = endIndex;
        const original = this.getSlice(start, endIndex);
        const name = this.lowerCaseTagNames ? original.toLowerCase() : original;
        if (this.htmlMode && (foreignContextElements.has(name) || htmlIntegrationElements.has(name))) this.foreignContext.shift();
        this.pending = {kind: 'close', name, tokenEnd: endIndex, phase: this.isVoidElement(name) ? 'finish' : 'find', scan: this.stack.save(), target: null};
        this.tokenizer.pause();
    }

    /** @internal */
    onselfclosingtag(endIndex: number): void {
        this.endIndex = endIndex;
        if (this.recognizeSelfClosing || this.foreignContext.peek()) {
            this.closeCurrentTag(false);

            // Set `startIndex` for next node
            this.startIndex = endIndex + 1;
        } else {
            // Ignore the fact that the tag is self-closing.
            this.onopentagend(endIndex);
        }
    }

    private closeCurrentTag(isOpenImplied: boolean) {
        const name = this.tagname;
        this.endOpenTag(isOpenImplied);

        // Self-closing tags will be on the top of the stack
        if (this.stack.peek()?.name === name) {
            // If the opening tag isn't implied, the closing tag has to be implied.
            this.cbs.onclosetag?.(name, !isOpenImplied);
            this.stack.pop();
        }
    }

    /** @internal */
    onattribname(start: number, endIndex: number): void {
        this.startIndex = start;
        const name = this.getSlice(start, endIndex);

        this.attribname = this.lowerCaseAttributeNames
            ? name.toLowerCase()
            : name;
    }

    /** @internal */
    onattribdata(start: number, endIndex: number): void {
        if (this.attribvalue.length + endIndex - start > this.limits.maxCarryChars) throw new Error("HTML_CHECKPOINT_ATTRIBUTE_LIMIT");
        this.attribvalue += this.getSlice(start, endIndex);
    }

    /** @internal */
    onattribentity(cp: number): void {
        this.attribvalue += fromCodePoint(cp);
    }

    /** @internal */
    onattribend(quote: QuoteType, endIndex: number): void {
        this.endIndex = endIndex;

        this.cbs.onattribute?.(
            this.attribname,
            this.attribvalue,
            quote === QuoteType.Double
                ? '"'
                : quote === QuoteType.Single
                  ? "'"
                  : quote === QuoteType.NoValue
                    ? undefined
                    : null,
        );

        if (
            this.attribs &&
            !Object.prototype.hasOwnProperty.call(this.attribs, this.attribname)
        ) {
            this.attribs[this.attribname] = this.attribvalue;
        }
        this.attribvalue = "";
    }

    private getInstructionName(value: string) {
        const index = value.search(reNameEnd);
        let name = index < 0 ? value : value.substr(0, index);

        if (this.lowerCaseTagNames) {
            name = name.toLowerCase();
        }

        return name;
    }

    /** @internal */
    ondeclaration(start: number, endIndex: number): void {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex);

        if (this.cbs.onprocessinginstruction) {
            const name = this.getInstructionName(value);
            this.cbs.onprocessinginstruction(`!${name}`, `!${value}`);
        }

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /** @internal */
    onprocessinginstruction(start: number, endIndex: number): void {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex);

        if (this.cbs.onprocessinginstruction) {
            const name = this.getInstructionName(value);
            this.cbs.onprocessinginstruction(`?${name}`, `?${value}`);
        }

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /** @internal */
    oncomment(start: number, endIndex: number, offset: number): void {
        this.endIndex = endIndex;

        this.cbs.oncomment?.(this.getSlice(start, endIndex - offset));
        this.cbs.oncommentend?.();

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /** @internal */
    oncdata(start: number, endIndex: number, offset: number): void {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex - offset);

        if (!this.htmlMode || this.options.recognizeCDATA) {
            this.cbs.oncdatastart?.();
            this.cbs.ontext?.(value);
            this.cbs.oncdataend?.();
        } else {
            this.cbs.oncomment?.(`[CDATA[${value}]]`);
            this.cbs.oncommentend?.();
        }

        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }

    /** @internal */
    onend(): void {
        this.endIndex = this.startIndex;
        this.pending = {kind: 'eof', scan: this.stack.save()}; this.tokenizer.pause();
    }

    needsDrain(): boolean { return !!this.textQueue.length || !!this.pending || (!this.tokenizer.running && !this.tokenizer.save().finished) || (this.ended && !this.completed); }
    eofRequested(): boolean { return this.ended; }
    isComplete(): boolean { return this.completed; }

    /** At most `maximum` linked-node transitions, with <=3 callbacks per atomic fallback. */
    advance(maximum: number): number {
        if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > 128) throw new Error('HTML_SEMANTIC_BUDGET_INVALID');
        let used = 0;
        while (used < maximum) {
            if (this.textQueue.length) { this.drainText(); used++; continue; }
            if (this.pending) { this.transition(); used++; continue; }
            if (!this.tokenizer.running && !this.tokenizer.save().finished) { this.tokenizer.resume(); if (this.pending || this.textQueue.length) continue; }
            // end(chunk) can request EOF while write(chunk) is paused. Only
            // finish the tokenizer after its retained input and callbacks drain;
            // `finished` makes this exactly once across save/restore.
            if (this.ended && !this.tokenizer.save().finished) {
                this.tokenizer.end();
                if (this.pending || this.textQueue.length) continue;
            }
            break;
        }
        return used;
    }

    private enqueueText(event: PendingText): void {
        if (this.textQueue.length >= 4) throw new Error('HTML_TEXT_EVENT_LIMIT');
        this.textQueue.push(event); this.tokenizer.pause();
    }

    private drainText(): void {
        const event = this.textQueue[0];
        const startIndex = this.startIndex; const endIndex = this.endIndex;
        this.startIndex = event.eventStartIndex; this.endIndex = event.eventEndIndex;
        try {
        // Batch bounded text work inside a transition while preserving the canonical
        // writer's character callbacks and its output backpressure. No whole field.
        const batch = event.kind === 'source'
            ? this.getSlice(event.start, Math.min(event.end, event.start + 256)) : event.value.slice(0, 256);
        for (let consumed = 0; consumed < batch.length; consumed++) {
            if (event.kind === 'source') {
                this.cbs.ontext?.(batch[consumed]);
                event.start++;
                if (event.start === event.end) { this.textQueue.shift(); break; }
            } else {
                this.cbs.ontext?.(batch[consumed]);
                event.value = event.value.slice(1);
                if (!event.value) { this.textQueue.shift(); break; }
            }
            if (this.options.yieldText?.()) break;
        }
        } finally { this.startIndex = startIndex; this.endIndex = endIndex; }
    }

    private transition(): void {
        const pending = this.pending;
        if (!pending) return;
        if (pending.kind === 'open') {
            const top = this.stack.peek(); const implies = this.htmlMode && openImpliesClose.get(pending.name);
            if (top && implies && implies.has(top.name)) { this.stack.pop(); this.cbs.onclosetag?.(top.name, true); return; }
            if (!this.isVoidElement(pending.name)) {
                this.stack.push(pending.name);
                if (this.htmlMode && foreignContextElements.has(pending.name)) this.foreignContext.unshift(true);
                else if (this.htmlMode && htmlIntegrationElements.has(pending.name)) this.foreignContext.unshift(false);
            }
            this.cbs.onopentagname?.(pending.name); if (this.cbs.onopentag) this.attribs = {};
            if (pending.tokenEnd !== null) {
                this.endOpenTag(false);
                this.startIndex = pending.tokenEnd + 1;
            }
            this.pending = null; return;
        }
        const scan = new TagStack(this.stores.tags, this.limits.maxCarryChars); scan.restore(pending.scan);
        if (pending.kind === 'eof') {
            const node = scan.pop();
            if (node) { pending.scan = scan.save(); this.cbs.onclosetag?.(node.name, true); return; }
            this.cbs.onend?.(); this.completed = true; this.pending = null; return;
        }
        if (pending.phase === 'find') {
            const node = scan.peek();
            if (node && node.name === pending.name) { pending.target = scan.save().head; pending.phase = 'pop'; return; }
            if (node) { scan.pop(); pending.scan = scan.save(); return; }
            if (this.htmlMode && pending.name === 'p') {
                this.tagname = 'p'; this.openTagStart = this.startIndex; this.stack.push('p');
                this.cbs.onopentagname?.('p'); if (this.cbs.onopentag) this.attribs = {};
                this.closeCurrentTag(true);
            }
            pending.phase = 'finish'; return;
        }
        if (pending.phase === 'pop') {
            const head = this.stack.save().head; const node = this.stack.pop();
            if (!node) throw new Error('HTML_SEMANTIC_TARGET_MISSING');
            this.cbs.onclosetag?.(node.name, head !== pending.target);
            if (head === pending.target) { pending.phase = 'finish'; pending.scan = this.stack.save(); }
            else pending.scan = this.stack.save();
            return;
        }
        if (this.htmlMode && pending.name === 'br') {
            this.cbs.onopentagname?.('br'); this.cbs.onopentag?.('br', {}, true); this.cbs.onclosetag?.('br', false);
        }
        this.startIndex = pending.tokenEnd + 1; this.pending = null;
    }

    /**
     * Resets the parser to a blank state, ready to parse a new HTML document
     */
    public reset(): void {
        this.cbs.onreset?.();
        this.tokenizer.reset();
        this.tagname = "";
        this.attribname = "";
        this.attribs = null;
        this.stack.reset(); this.pending = null; this.textQueue = []; this.completed = false;
        this.startIndex = 0;
        this.endIndex = 0;
        this.cbs.onparserinit?.(this);
        this.sourceText.reset();
        this.foreignContext.reset();
        this.foreignContext.unshift(!this.htmlMode);
        this.ended = false;
    }

    /**
     * Resets the parser, then parses a complete document and
     * pushes it to the handler.
     *
     * @param data Document to parse.
     */
    public parseComplete(data: string): void {
        this.reset();
        this.end(data);
    }

    private getSlice(start: number, end: number): string {
        return this.sourceText.slice(start, end);
    }

    /**
     * Parses a chunk of data and calls the corresponding callbacks.
     *
     * @param chunk Chunk to parse.
     */
    public write(chunk: string): void {
        if (this.ended) {
            this.cbs.onerror?.(new Error(".write() after done!"));
            return;
        }

        if (chunk.length > this.limits.maxInputChars) throw new Error("CHECKPOINT_INPUT_LIMIT");
        if (this.needsDrain()) throw new Error("HTML_CHECKPOINT_BACKPRESSURE");
        this.sourceText.append(chunk);
        if (this.tokenizer.running) {
            this.tokenizer.write(chunk);

        }
    }

    /**
     * Parses the end of the buffer and clears the stack, calls onend.
     *
     * @param chunk Optional final chunk to parse.
     */
    public end(chunk?: string): void {
        if (this.ended) {
            this.cbs.onerror?.(new Error(".end() after done!"));
            return;
        }

        if (chunk) this.write(chunk);
        this.ended = true;
        this.tokenizer.end();
    }

    /**
     * Pauses parsing. The parser won't emit events until `resume` is called.
     */
    public pause(): void {
        this.tokenizer.pause();
    }

    /**
     * Resumes parsing after `pause` was called.
     */
    public resume(): void { this.advance(32); }

    /**
     * Alias of `write`, for backwards compatibility.
     *
     * @param chunk Chunk to parse.
     * @deprecated
     */
    public parseChunk(chunk: string): void {
        this.write(chunk);
    }
    /**
     * Alias of `end`, for backwards compatibility.
     *
     * @param chunk Optional final chunk to parse.
     * @deprecated
     */
    public done(chunk?: string): void {
        this.end(chunk);
    }
}
