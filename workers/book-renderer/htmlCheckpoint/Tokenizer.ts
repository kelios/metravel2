// Derived from htmlparser2 10.1.0; see LICENSE-htmlparser2 and UPSTREAM.json.
import { EntityDecoder, DecodingMode } from "@/workers/book-renderer/htmlCheckpoint/entities/EntityDecoder";
import { htmlDecodeTree } from "@/workers/book-renderer/htmlCheckpoint/entities/htmlDecodeTree";
import { xmlDecodeTree } from "@/workers/book-renderer/htmlCheckpoint/entities/xmlDecodeTree";
import { CharCodes, State, Sequences, QuoteType, isWhitespace, isEndOfTagSection, isASCIIAlpha, type Callbacks } from "@/workers/book-renderer/htmlCheckpoint/lexicalDefinitions";
import { validateTokenizerCheckpoint, type TokenizerCheckpoint } from "@/workers/book-renderer/htmlCheckpoint/state";
export default class Tokenizer {
    /** The current state the tokenizer is in. */
    private state = State.Text;
    /** The read buffer. */
    private buffer = "";
    /** The beginning of the section that is currently being read. */
    private sectionStart = 0;
    /** The index within the buffer that we are currently looking at. */
    private index = 0;
    /** The start of the last entity. */
    private entityStart = 0;
    /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */
    private baseState = State.Text;
    /** For special parsing behavior inside of script and style tags. */
    private isSpecial = false;
    /** Indicates whether the tokenizer has been paused. */
    public running = true;
    private finished = false;
    /** The offset of the current buffer. */
    private offset = 0;

    private readonly xmlMode: boolean;
    private readonly decodeEntities: boolean;
    private readonly entityDecoder: EntityDecoder;
    private readonly maxCarryChars: number;

    constructor(
        {
            xmlMode = false,
            decodeEntities = true,
            maxCarryChars = 65536,
        }: { xmlMode?: boolean; decodeEntities?: boolean; maxCarryChars?: number },
        private readonly cbs: Callbacks,
    ) {
        this.xmlMode = xmlMode;
        this.decodeEntities = decodeEntities;
        this.maxCarryChars = maxCarryChars;
        this.entityDecoder = new EntityDecoder(
            xmlMode ? xmlDecodeTree : htmlDecodeTree,
            (cp, consumed) => this.emitCodePoint(cp, consumed),
        );
    }

    save(): TokenizerCheckpoint {
        const currentSequence = Object.entries(Sequences).find(([, value]) => value === this.currentSequence)?.[0] ?? null;
        return validateTokenizerCheckpoint({version: 1, state: this.state, buffer: this.buffer,
            sectionStart: this.sectionStart, index: this.index, entityStart: this.entityStart,
            baseState: this.baseState, isSpecial: this.isSpecial, running: this.running, finished: this.finished,
            offset: this.offset, currentSequence, sequenceIndex: this.sequenceIndex,
            entity: this.entityDecoder.save()}, this.buffer.length, this.xmlMode ? xmlDecodeTree.length : htmlDecodeTree.length);
    }

    restore(value: unknown, maximum: number): void {
        const state = validateTokenizerCheckpoint(value, maximum, this.xmlMode ? xmlDecodeTree.length : htmlDecodeTree.length);
        this.state = state.state; this.buffer = state.buffer; this.sectionStart = state.sectionStart;
        this.index = state.index; this.entityStart = state.entityStart; this.baseState = state.baseState;
        this.isSpecial = state.isSpecial; this.running = state.running; this.finished = state.finished; this.offset = state.offset;
        this.currentSequence = state.currentSequence === null ? undefined! : Sequences[state.currentSequence];
        this.sequenceIndex = state.sequenceIndex; this.entityDecoder.restore(state.entity);
    }

    pendingCharacters(): number { return this.sectionStart < 0 ? 0 : this.index - this.sectionStart; }

    public reset(): void {
        this.state = State.Text;
        this.buffer = "";
        this.sectionStart = 0;
        this.index = 0;
        this.baseState = State.Text;
        this.currentSequence = undefined!;
        this.running = true;
        this.offset = 0; this.finished = false;
    }

    public write(chunk: string): void {
        this.offset += this.buffer.length;
        this.buffer = chunk;
        this.parse();
    }

    public end(): void {
        if (this.running) { this.finish(); this.finished = true; }
    }

    public pause(): void {
        this.running = false;
    }

    public resume(): void {
        this.running = true;
        if (this.index < this.buffer.length + this.offset) {
            this.parse();
        }
    }

    private stateText(c: number): void {
        if (
            c === CharCodes.Lt ||
            (!this.decodeEntities && this.fastForwardTo(CharCodes.Lt))
        ) {
            if (this.index > this.sectionStart) {
                this.cbs.ontext(this.sectionStart, this.index);
            }
            this.state = State.BeforeTagName;
            this.sectionStart = this.index;
        } else if (this.decodeEntities && c === CharCodes.Amp) {
            this.startEntity();
        }
    }

    private currentSequence: Uint8Array = undefined!;
    private sequenceIndex = 0;
    private stateSpecialStartSequence(c: number): void {
        const isEnd = this.sequenceIndex === this.currentSequence.length;
        const isMatch = isEnd
            ? // If we are at the end of the sequence, make sure the tag name has ended
              isEndOfTagSection(c)
            : // Otherwise, do a case-insensitive comparison
              (c | 0x20) === this.currentSequence[this.sequenceIndex];

        if (!isMatch) {
            this.isSpecial = false;
        } else if (!isEnd) {
            this.sequenceIndex++;
            return;
        }

        this.sequenceIndex = 0;
        this.state = State.InTagName;
        this.stateInTagName(c);
    }

    /** Look for an end tag. For <title> tags, also decode entities. */
    private stateInSpecialTag(c: number): void {
        if (this.sequenceIndex === this.currentSequence.length) {
            if (c === CharCodes.Gt || isWhitespace(c)) {
                const endOfText = this.index - this.currentSequence.length;

                if (this.sectionStart < endOfText) {
                    // Spoof the index so that reported locations match up.
                    const actualIndex = this.index;
                    this.index = endOfText;
                    this.cbs.ontext(this.sectionStart, endOfText);
                    this.index = actualIndex;
                }

                this.isSpecial = false;
                this.sectionStart = endOfText + 2; // Skip over the `</`
                this.stateInClosingTagName(c);
                return; // We are done; skip the rest of the function.
            }

            this.sequenceIndex = 0;
        }

        if ((c | 0x20) === this.currentSequence[this.sequenceIndex]) {
            this.sequenceIndex += 1;
        } else if (this.sequenceIndex === 0) {
            if (this.currentSequence === Sequences.TitleEnd) {
                // We have to parse entities in <title> tags.
                if (this.decodeEntities && c === CharCodes.Amp) {
                    this.startEntity();
                }
            } else if (this.fastForwardTo(CharCodes.Lt)) {
                // Outside of <title> tags, we can fast-forward.
                this.sequenceIndex = 1;
            }
        } else {
            // If we see a `<`, set the sequence index to 1; useful for eg. `<</script>`.
            this.sequenceIndex = Number(c === CharCodes.Lt);
        }
    }

    private stateCDATASequence(c: number): void {
        if (c === Sequences.Cdata[this.sequenceIndex]) {
            if (++this.sequenceIndex === Sequences.Cdata.length) {
                this.state = State.InCommentLike;
                this.currentSequence = Sequences.CdataEnd;
                this.sequenceIndex = 0;
                this.sectionStart = this.index + 1;
            }
        } else {
            this.sequenceIndex = 0;
            this.state = State.InDeclaration;
            this.stateInDeclaration(c); // Reconsume the character
        }
    }

    /**
     * When we wait for one specific character, we can speed things up
     * by skipping through the buffer until we find it.
     *
     * @returns Whether the character was found.
     */
    private fastForwardTo(c: number): boolean {
        while (++this.index < this.buffer.length + this.offset) {
            if (this.buffer.charCodeAt(this.index - this.offset) === c) {
                return true;
            }
        }

        /*
         * We increment the index at the end of the `parse` loop,
         * so set it to `buffer.length - 1` here.
         *
         * TODO: Refactor `parse` to increment index before calling states.
         */
        this.index = this.buffer.length + this.offset - 1;

        return false;
    }

    /**
     * Comments and CDATA end with `-->` and `]]>`.
     *
     * Their common qualities are:
     * - Their end sequences have a distinct character they start with.
     * - That character is then repeated, so we have to check multiple repeats.
     * - All characters but the start character of the sequence can be skipped.
     */
    private stateInCommentLike(c: number): void {
        if (c === this.currentSequence[this.sequenceIndex]) {
            if (++this.sequenceIndex === this.currentSequence.length) {
                if (this.currentSequence === Sequences.CdataEnd) {
                    this.cbs.oncdata(this.sectionStart, this.index, 2);
                } else {
                    this.cbs.oncomment(this.sectionStart, this.index, 2);
                }

                this.sequenceIndex = 0;
                this.sectionStart = this.index + 1;
                this.state = State.Text;
            }
        } else if (this.sequenceIndex === 0) {
            // Fast-forward to the first character of the sequence
            if (this.fastForwardTo(this.currentSequence[0])) {
                this.sequenceIndex = 1;
            }
        } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
            // Allow long sequences, eg. --->, ]]]>
            this.sequenceIndex = 0;
        }
    }

    /**
     * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
     *
     * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
     * We allow anything that wouldn't end the tag.
     */
    private isTagStartChar(c: number) {
        return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c);
    }

    private startSpecial(sequence: Uint8Array, offset: number) {
        this.isSpecial = true;
        this.currentSequence = sequence;
        this.sequenceIndex = offset;
        this.state = State.SpecialStartSequence;
    }

    private stateBeforeTagName(c: number): void {
        if (c === CharCodes.ExclamationMark) {
            this.state = State.BeforeDeclaration;
            this.sectionStart = this.index + 1;
        } else if (c === CharCodes.Questionmark) {
            this.state = State.InProcessingInstruction;
            this.sectionStart = this.index + 1;
        } else if (this.isTagStartChar(c)) {
            const lower = c | 0x20;
            this.sectionStart = this.index;
            if (this.xmlMode) {
                this.state = State.InTagName;
            } else if (lower === Sequences.ScriptEnd[2]) {
                this.state = State.BeforeSpecialS;
            } else if (
                lower === Sequences.TitleEnd[2] ||
                lower === Sequences.XmpEnd[2]
            ) {
                this.state = State.BeforeSpecialT;
            } else {
                this.state = State.InTagName;
            }
        } else if (c === CharCodes.Slash) {
            this.state = State.BeforeClosingTagName;
        } else {
            this.state = State.Text;
            this.stateText(c);
        }
    }
    private stateInTagName(c: number): void {
        if (isEndOfTagSection(c)) {
            this.cbs.onopentagname(this.sectionStart, this.index);
            this.sectionStart = -1;
            this.state = State.BeforeAttributeName;
            this.stateBeforeAttributeName(c);
        }
    }
    private stateBeforeClosingTagName(c: number): void {
        if (isWhitespace(c)) {
            // Ignore
        } else if (c === CharCodes.Gt) {
            this.state = State.Text;
        } else {
            this.state = this.isTagStartChar(c)
                ? State.InClosingTagName
                : State.InSpecialComment;
            this.sectionStart = this.index;
        }
    }
    private stateInClosingTagName(c: number): void {
        if (c === CharCodes.Gt || isWhitespace(c)) {
            this.cbs.onclosetag(this.sectionStart, this.index);
            this.sectionStart = -1;
            this.state = State.AfterClosingTagName;
            this.stateAfterClosingTagName(c);
        }
    }
    private stateAfterClosingTagName(c: number): void {
        // Skip everything until ">"
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    private stateBeforeAttributeName(c: number): void {
        if (c === CharCodes.Gt) {
            this.cbs.onopentagend(this.index);
            if (this.isSpecial) {
                this.state = State.InSpecialTag;
                this.sequenceIndex = 0;
            } else {
                this.state = State.Text;
            }
            this.sectionStart = this.index + 1;
        } else if (c === CharCodes.Slash) {
            this.state = State.InSelfClosingTag;
        } else if (!isWhitespace(c)) {
            this.state = State.InAttributeName;
            this.sectionStart = this.index;
        }
    }
    private stateInSelfClosingTag(c: number): void {
        if (c === CharCodes.Gt) {
            this.cbs.onselfclosingtag(this.index);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
            this.isSpecial = false; // Reset special state, in case of self-closing special tags
        } else if (!isWhitespace(c)) {
            this.state = State.BeforeAttributeName;
            this.stateBeforeAttributeName(c);
        }
    }
    private stateInAttributeName(c: number): void {
        if (c === CharCodes.Eq || isEndOfTagSection(c)) {
            this.cbs.onattribname(this.sectionStart, this.index);
            this.sectionStart = this.index;
            this.state = State.AfterAttributeName;
            this.stateAfterAttributeName(c);
        }
    }
    private stateAfterAttributeName(c: number): void {
        if (c === CharCodes.Eq) {
            this.state = State.BeforeAttributeValue;
        } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
            this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
            this.sectionStart = -1;
            this.state = State.BeforeAttributeName;
            this.stateBeforeAttributeName(c);
        } else if (!isWhitespace(c)) {
            this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
            this.state = State.InAttributeName;
            this.sectionStart = this.index;
        }
    }
    private stateBeforeAttributeValue(c: number): void {
        if (c === CharCodes.DoubleQuote) {
            this.state = State.InAttributeValueDq;
            this.sectionStart = this.index + 1;
        } else if (c === CharCodes.SingleQuote) {
            this.state = State.InAttributeValueSq;
            this.sectionStart = this.index + 1;
        } else if (!isWhitespace(c)) {
            this.sectionStart = this.index;
            this.state = State.InAttributeValueNq;
            this.stateInAttributeValueNoQuotes(c); // Reconsume token
        }
    }
    private handleInAttributeValue(c: number, quote: number) {
        if (
            c === quote ||
            (!this.decodeEntities && this.fastForwardTo(quote))
        ) {
            this.cbs.onattribdata(this.sectionStart, this.index);
            this.sectionStart = -1;
            this.cbs.onattribend(
                quote === CharCodes.DoubleQuote
                    ? QuoteType.Double
                    : QuoteType.Single,
                this.index + 1,
            );
            this.state = State.BeforeAttributeName;
        } else if (this.decodeEntities && c === CharCodes.Amp) {
            this.startEntity();
        }
    }
    private stateInAttributeValueDoubleQuotes(c: number): void {
        this.handleInAttributeValue(c, CharCodes.DoubleQuote);
    }
    private stateInAttributeValueSingleQuotes(c: number): void {
        this.handleInAttributeValue(c, CharCodes.SingleQuote);
    }
    private stateInAttributeValueNoQuotes(c: number): void {
        if (isWhitespace(c) || c === CharCodes.Gt) {
            this.cbs.onattribdata(this.sectionStart, this.index);
            this.sectionStart = -1;
            this.cbs.onattribend(QuoteType.Unquoted, this.index);
            this.state = State.BeforeAttributeName;
            this.stateBeforeAttributeName(c);
        } else if (this.decodeEntities && c === CharCodes.Amp) {
            this.startEntity();
        }
    }
    private stateBeforeDeclaration(c: number): void {
        if (c === CharCodes.OpeningSquareBracket) {
            this.state = State.CDATASequence;
            this.sequenceIndex = 0;
        } else {
            this.state =
                c === CharCodes.Dash
                    ? State.BeforeComment
                    : State.InDeclaration;
        }
    }
    private stateInDeclaration(c: number): void {
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.cbs.ondeclaration(this.sectionStart, this.index);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    private stateInProcessingInstruction(c: number): void {
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.cbs.onprocessinginstruction(this.sectionStart, this.index);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    private stateBeforeComment(c: number): void {
        if (c === CharCodes.Dash) {
            this.state = State.InCommentLike;
            this.currentSequence = Sequences.CommentEnd;
            // Allow short comments (eg. <!-->)
            this.sequenceIndex = 2;
            this.sectionStart = this.index + 1;
        } else {
            this.state = State.InDeclaration;
        }
    }
    private stateInSpecialComment(c: number): void {
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.cbs.oncomment(this.sectionStart, this.index, 0);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    private stateBeforeSpecialS(c: number): void {
        const lower = c | 0x20;
        if (lower === Sequences.ScriptEnd[3]) {
            this.startSpecial(Sequences.ScriptEnd, 4);
        } else if (lower === Sequences.StyleEnd[3]) {
            this.startSpecial(Sequences.StyleEnd, 4);
        } else {
            this.state = State.InTagName;
            this.stateInTagName(c); // Consume the token again
        }
    }

    private stateBeforeSpecialT(c: number): void {
        const lower = c | 0x20;
        switch (lower) {
            case Sequences.TitleEnd[3]: {
                this.startSpecial(Sequences.TitleEnd, 4);

                break;
            }
            case Sequences.TextareaEnd[3]: {
                this.startSpecial(Sequences.TextareaEnd, 4);

                break;
            }
            case Sequences.XmpEnd[3]: {
                this.startSpecial(Sequences.XmpEnd, 4);

                break;
            }
            default: {
                this.state = State.InTagName;
                this.stateInTagName(c); // Consume the token again
            }
        }
    }

    private startEntity() {
        this.baseState = this.state;
        this.state = State.InEntity;
        this.entityStart = this.index;
        this.entityDecoder.startEntity(
            this.xmlMode
                ? DecodingMode.Strict
                : this.baseState === State.Text ||
                    this.baseState === State.InSpecialTag
                  ? DecodingMode.Legacy
                  : DecodingMode.Attribute,
        );
    }

    private stateInEntity(): void {
        const indexInBuffer = this.index - this.offset;
        const length = this.entityDecoder.write(this.buffer, indexInBuffer);

        // If `length` is positive, we are done with the entity.
        if (length >= 0) {
            this.state = this.baseState;

            if (length === 0) {
                this.index -= 1;
            }
        } else {
            if (
                indexInBuffer < this.buffer.length &&
                this.buffer.charCodeAt(indexInBuffer) === CharCodes.Amp
            ) {
                this.state = this.baseState;
                this.index -= 1;
                return;
            }

            // Mark buffer as consumed.
            this.index = this.offset + this.buffer.length - 1;
        }
    }

    /**
     * Remove data that has already been consumed from the buffer.
     */
    private cleanup() {
        // If we are inside of text or attributes, emit what we already have.
        if (this.running && this.sectionStart !== this.index) {
            if (
                this.state === State.Text ||
                (this.state === State.InSpecialTag && this.sequenceIndex === 0)
            ) {
                this.cbs.ontext(this.sectionStart, this.index);
                this.sectionStart = this.index;
            } else if (
                this.state === State.InAttributeValueDq ||
                this.state === State.InAttributeValueSq ||
                this.state === State.InAttributeValueNq
            ) {
                this.cbs.onattribdata(this.sectionStart, this.index);
                this.sectionStart = this.index;
            }
        }
    }

    private shouldContinue() {
        return this.index < this.buffer.length + this.offset && this.running;
    }

    /**
     * Iterates through the buffer, calling the function corresponding to the current state.
     *
     * States that are more likely to be hit are higher up, as a performance improvement.
     */
    private parse() {
        while (this.shouldContinue()) {
            if (this.pendingCharacters() > this.maxCarryChars) throw new Error("HTML_CHECKPOINT_TOKEN_LIMIT");
            const c = this.buffer.charCodeAt(this.index - this.offset);
            switch (this.state) {
                case State.Text: {
                    this.stateText(c);
                    break;
                }
                case State.SpecialStartSequence: {
                    this.stateSpecialStartSequence(c);
                    break;
                }
                case State.InSpecialTag: {
                    this.stateInSpecialTag(c);
                    break;
                }
                case State.CDATASequence: {
                    this.stateCDATASequence(c);
                    break;
                }
                case State.InAttributeValueDq: {
                    this.stateInAttributeValueDoubleQuotes(c);
                    break;
                }
                case State.InAttributeName: {
                    this.stateInAttributeName(c);
                    break;
                }
                case State.InCommentLike: {
                    this.stateInCommentLike(c);
                    break;
                }
                case State.InSpecialComment: {
                    this.stateInSpecialComment(c);
                    break;
                }
                case State.BeforeAttributeName: {
                    this.stateBeforeAttributeName(c);
                    break;
                }
                case State.InTagName: {
                    this.stateInTagName(c);
                    break;
                }
                case State.InClosingTagName: {
                    this.stateInClosingTagName(c);
                    break;
                }
                case State.BeforeTagName: {
                    this.stateBeforeTagName(c);
                    break;
                }
                case State.AfterAttributeName: {
                    this.stateAfterAttributeName(c);
                    break;
                }
                case State.InAttributeValueSq: {
                    this.stateInAttributeValueSingleQuotes(c);
                    break;
                }
                case State.BeforeAttributeValue: {
                    this.stateBeforeAttributeValue(c);
                    break;
                }
                case State.BeforeClosingTagName: {
                    this.stateBeforeClosingTagName(c);
                    break;
                }
                case State.AfterClosingTagName: {
                    this.stateAfterClosingTagName(c);
                    break;
                }
                case State.BeforeSpecialS: {
                    this.stateBeforeSpecialS(c);
                    break;
                }
                case State.BeforeSpecialT: {
                    this.stateBeforeSpecialT(c);
                    break;
                }
                case State.InAttributeValueNq: {
                    this.stateInAttributeValueNoQuotes(c);
                    break;
                }
                case State.InSelfClosingTag: {
                    this.stateInSelfClosingTag(c);
                    break;
                }
                case State.InDeclaration: {
                    this.stateInDeclaration(c);
                    break;
                }
                case State.BeforeDeclaration: {
                    this.stateBeforeDeclaration(c);
                    break;
                }
                case State.BeforeComment: {
                    this.stateBeforeComment(c);
                    break;
                }
                case State.InProcessingInstruction: {
                    this.stateInProcessingInstruction(c);
                    break;
                }
                case State.InEntity: {
                    this.stateInEntity();
                    break;
                }
            }
            this.index++;
        }
        if (this.pendingCharacters() > this.maxCarryChars) throw new Error("HTML_CHECKPOINT_TOKEN_LIMIT");
        this.cleanup();
    }

    private finish() {
        if (this.state === State.InEntity) {
            this.entityDecoder.end();
            this.state = this.baseState;
        }

        this.handleTrailingData();

        this.cbs.onend();
    }

    /** Handle any trailing data. */
    private handleTrailingData() {
        const endIndex = this.buffer.length + this.offset;

        // If there is no remaining data, we are done.
        if (this.sectionStart >= endIndex) {
            return;
        }

        if (this.state === State.InCommentLike) {
            if (this.currentSequence === Sequences.CdataEnd) {
                this.cbs.oncdata(this.sectionStart, endIndex, 0);
            } else {
                this.cbs.oncomment(this.sectionStart, endIndex, 0);
            }
        } else if (
            this.state === State.InTagName ||
            this.state === State.BeforeAttributeName ||
            this.state === State.BeforeAttributeValue ||
            this.state === State.AfterAttributeName ||
            this.state === State.InAttributeName ||
            this.state === State.InAttributeValueSq ||
            this.state === State.InAttributeValueDq ||
            this.state === State.InAttributeValueNq ||
            this.state === State.InClosingTagName
        ) {
            /*
             * If we are currently in an opening or closing tag, us not calling the
             * respective callback signals that the tag should be ignored.
             */
        } else {
            this.cbs.ontext(this.sectionStart, endIndex);
        }
    }

    private emitCodePoint(cp: number, consumed: number): void {
        if (
            this.baseState !== State.Text &&
            this.baseState !== State.InSpecialTag
        ) {
            if (this.sectionStart < this.entityStart) {
                this.cbs.onattribdata(this.sectionStart, this.entityStart);
            }
            this.sectionStart = this.entityStart + consumed;
            this.index = this.sectionStart - 1;

            this.cbs.onattribentity(cp);
        } else {
            if (this.sectionStart < this.entityStart) {
                this.cbs.ontext(this.sectionStart, this.entityStart);
            }
            this.sectionStart = this.entityStart + consumed;
            this.index = this.sectionStart - 1;

            this.cbs.ontextentity(cp, this.sectionStart);
        }
    }
}
