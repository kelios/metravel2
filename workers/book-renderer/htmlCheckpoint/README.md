# Canonical HTML checkpoint port

This private worker port derives its HTML callbacks from htmlparser2 **10.1.0**
and its entity decoder and immutable decode tables from the nested entities
**7.0.1** dependency. `UPSTREAM.json` pins original source hashes. Retain both
`LICENSE-htmlparser2` (MIT) and `LICENSE-entities` (BSD 2 clause) in artifacts.
The artifact's own file inventory must additionally pin this modified port.

`Parser.save()` / `restore()` are explicit APIs on owned code, not access to
upstream parser internals. Protocol 1 retains tokenizer/entity state, parser
attributes/open tags and the bounded source tail. Save between completed feeds,
never inside a callback. `end()` represents actual field EOF, never a portion
boundary. Resumption requires identical options, limits and scoped stores.

Foreign-context nodes are immutable content-addressed linked records: push,
pop and restore use bounded I/O even when malformed HTML accumulates hidden
foreign contexts outside the open-tag stack. Source text uses fixed 1024 UTF16
code-unit blocks and a bounded tail; range access addresses blocks directly.
Transfer chunk boundaries remain unchanged, including surrogate splits.

`createDiskCheckpointStores()` requires a caller-created, existing canonical
(realpath), epoch/field-private directory with mode0700. It never chmods that
root or creates its parents; it creates only direct private store children.
Symlink/wrongmode roots, children and files are rejected; published files and
containing directories are fsynced. Original
source provenance and the committed block output inventory remain the caller's
responsibility; a block's self-checksum alone does not certify its relationship
to a frozen snapshot. Store roots must not be shared between unrelated fields
or snapshots. The caller enforces the job's private-disk budget and publication
fencing. Source files, decode tables and checkpoint files are private inputs.

Legacy `incrementalContent()` remains independent and unchanged as the behavior
oracle. A resumable integration must prove fragment/image/list/table/FAQ parity,
not just similar plain text. This port does not establish Linux capacity,
planning completion or production download readiness.

The parser tag stack also uses immutable `stack/<sha256>.json` linked nodes,
including original case. A close event checkpoints a nearest-name scan followed
by bounded pops. EOF traverses a separate cursor without popping the original
stack, as the upstream parser does. No total parser stack depth cap is imposed;
the canonical Writer retains its existing nesting policy.

An opening-name delimiter `>` is reconsumed by the tokenizer before its pause
takes effect. The pending open operation retains that delimiter's end offset,
then emits the end-open/void callbacks only after implied closes, stack push,
name callback and attributes initialization. This bounded atomic completion
has at most three callbacks; restoration never lets end-open overtake name.

`incrementalContentStep()` accepts a bounded feed exactly once. `acceptedChars`
reports accepted source units; `needsDrain` backpressures further nonempty input.
Empty-input calls continue pending text, close, open or EOF transitions.
`eofRequested` records true field EOF independently of completion. The caller
must drain until `done` before publishing the field or finishing its snapshot.

The generic Parser defaults to original unsplit text callbacks. Its private
`boundedTextCallbacks` policy subdivides Writer text events while retaining
source ranges and original event indices. Each transition consumes one UTF16
unit; Writer's unchanged pending-surrogate algorithm joins valid pairs exactly.
A tokenizer character can emit one source prefix and up to two entity code
points (`EntityDecoder.emitNamedEntityData`); true EOF can add one trailing
source event. Therefore the pending text queue contains at most four records,
with decoded literals at most two UTF16 units each. Paused cleanup emits no
additional events. A range remains in the immutable source spool, never a whole
string in a checkpoint. Pending text drains before semantic close/EOF events.
The mode excludes XML/recognized CDATA; the worker's canonical HTML policy treats
CDATA as comments and retains the original generic mode for other policies.

`createDiskCheckpointStores(root, {onwrite})` reports `{ref, checksum,
size_bytes, created}` after immutable publication and directory fsync, including
verified existing retries. Ref paths are relative to this field/pass root;
checksums and sizes describe exact UTF8 file bytes. The caller synchronously
admits each receipt to its output ledger before a put returns success.

Exported conservative output-work bounds are two fixed store receipts per step,
two store receipts per semantic transition, six fixed fragments per step and
ten fragments per transition. These include constructor retries, one source
block crossing, original atomic fallback callbacks, lexical open/void callbacks
and final Writer completion. Consumers reserve their own checkpoint/index
outputs and derive `maxSemanticTransitions` from the declared output-record
budget; the default is not permission to exceed that ledger budget.
EOF instructions with a near-full reopen wrapper can yield one fragment per
character, so a small source byte feed alone cannot bound fragment records.
EOF and text subdivision require exact legacy-fragment tests, not an assumption
that a 64KiB lexical token fits one private output batch.
