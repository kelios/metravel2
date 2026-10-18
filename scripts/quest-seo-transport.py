#!/usr/bin/env python3
"""Private E transport over the existing SSH/app channel; never a serving API."""
import contextlib
import fcntl
import gzip
import io
import hashlib
import json
import os
import resource
import shutil
import struct
from pathlib import Path, PurePosixPath
import stat
import subprocess
import sys
import tarfile
import tempfile

MAX_FILES = 50000
MAX_BYTES = 2 * 1024 * 1024 * 1024
MAX_INDEX_BYTES = 8 * 1024 * 1024
MAX_TRANSFER_PLAN_BYTES = MAX_INDEX_BYTES + 16384
MAX_SOURCE_FILES = 100000
BACKEND_RESERVE = 1536 * 1024 * 1024
INDEX_NAME = '.storage-index.v2.json'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def static_preflight(remote, app, nginx):
    """Validate physical shared roots, including binds on a static ancestor."""
    root = Path(remote) / 'static'
    require(root.is_absolute() and root.resolve(strict=True) == root and root.is_dir(),
            'Canonical physical static parent required')
    info = root.stat()
    identity = f'{info.st_dev}:{info.st_ino}:{info.st_uid}'

    def docker(*args):
        return subprocess.check_output(['docker', *args], text=True, timeout=20,
                                       stderr=subprocess.PIPE).strip()

    for container, target, writer in [(app, '/app/static', True),
                                      (nginx, '/usr/local/metravel/static', False)]:
        mounts = json.loads(docker('inspect', '--format', '{{json .Mounts}}', container))
        require(isinstance(mounts, list), 'Docker mount list required')
        destinations, covering = set(), []
        target_path = PurePosixPath(target)
        for mount in mounts:
            require(isinstance(mount, dict) and isinstance(mount.get('Destination'), str),
                    'Invalid Docker mount')
            destination = PurePosixPath(mount['Destination'])
            require(destination.is_absolute() and str(destination) == mount['Destination']
                    and '..' not in destination.parts and destination not in destinations,
                    'Noncanonical or duplicate mount destination')
            destinations.add(destination)
            require(target_path not in destination.parents, 'Nested static mount refused')
            if destination == target_path or destination in target_path.parents:
                covering.append((destination, mount))
        require(covering, 'Static bind mount missing')
        destination, mount = max(covering, key=lambda entry: len(entry[0].parts))
        require(mount.get('Type') == 'bind' and isinstance(mount.get('Source'), str),
                'Static parent must be a bind mount')
        require(not writer or mount.get('RW') is True, 'App static bind must be writable')
        source = Path(mount['Source'])
        effective = source.joinpath(*target_path.relative_to(destination).parts)
        require(source.is_absolute() and str(source) == mount['Source']
                and source.resolve(strict=True) == source and effective == root,
                'Static bind source mismatch or symlink')
        check = 'test -d "$1" && test ! -L "$1" && test "$(readlink -f "$1")" = "$1"'
        if writer:
            check += ' && test -w "$1" && test -x "$1" && test "$(id -u)" = "$2"'
        check += ' && stat -c "%d:%i:%u" "$1"'
        require(docker('exec', container, 'sh', '-c', check, 'static-preflight',
                       target, str(info.st_uid)) == identity, 'Physical static identity mismatch')


def regular_tree(root):
    require(root.is_dir() and not root.is_symlink(), "Physical tree required")
    count, size = 0, 0
    def fail(error):
        raise error
    for parent, directories, files in os.walk(root, followlinks=False, onerror=fail):
        for name in sorted(directories + files):
            entry = Path(parent) / name
            info = entry.lstat()
            require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode), "Links/special files refused")
            count += 1
            size += info.st_size if stat.S_ISREG(info.st_mode) else 0
            require(count <= MAX_FILES and size <= MAX_BYTES, "Tree bound exceeded")
            yield entry


def pack(root, *, assets=False, compresslevel=1):
    # Stream gzip separately: Python 3.11 tarfile stream mode has no compresslevel.
    with gzip.GzipFile(fileobj=sys.stdout.buffer, mode='wb', compresslevel=compresslevel, mtime=0) as compressed, \
            tarfile.open(fileobj=compressed, mode='w|', dereference=True) as archive:
        for entry in regular_tree(root):
            if assets and entry.suffix not in ('.js', '.css'):
                continue
            member = archive.gettarinfo(entry, arcname=entry.relative_to(root).as_posix())
            member.mtime = int(member.mtime) if member.isfile() else 0
            member.mode = 0o644 if member.isfile() else 0o755
            member.uid = member.gid = 0
            member.uname = member.gname = ''
            if member.isfile():
                with file_at(root, entry.relative_to(root).as_posix()) as (source, _, __):
                    before = os.fstat(source.fileno())
                    require(before.st_size == member.size, 'Archive source changed')
                    archive.addfile(member, source)
                    after = os.fstat(source.fileno())
                    require(file_identity(before) == file_identity(after) and before.st_ctime_ns == after.st_ctime_ns,
                            'Archive source changed')
            else:
                archive.addfile(member)


def unpack(root):
    size, seen, all_paths = 0, set(), set()
    with tarfile.open(fileobj=sys.stdin.buffer, mode="r|gz") as archive:
        for member in archive:
            parts = PurePosixPath(member.name).parts
            require(parts and len(parts) <= 64 and len(member.name) <= 1024
                    and not member.name.startswith('/') and '..' not in parts, "Archive path refused")
            relative = '/'.join(parts)
            require(relative not in seen and (member.isfile() or member.isdir()), "Archive link/duplicate/special file refused")
            seen.add(relative)
            all_paths.update('/'.join(parts[:index]) for index in range(1, len(parts) + 1))
            size += member.size
            require(len(all_paths) <= MAX_FILES and size <= MAX_BYTES, "Archive bound exceeded")
            target = root.joinpath(*parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            require(target.parent.resolve() == target.parent, "Archive parent link refused")
            if member.isdir():
                target.mkdir(exist_ok=True)
                require(not target.is_symlink(), "Archive directory link refused")
                continue
            with target.open('xb') as output, archive.extractfile(member) as source:
                remaining = member.size
                while remaining:
                    chunk = source.read(min(remaining, 1024 * 1024))
                    require(chunk, "Truncated archive")
                    output.write(chunk)
                    remaining -= len(chunk)
            os.chmod(target, 0o644)
            os.utime(target, (member.mtime, member.mtime))


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'Duplicate private JSON key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs)


def safe_parts(relative):
    require(isinstance(relative, str), 'Relative path required')
    parts = PurePosixPath(relative).parts
    require(parts and len(parts) <= 64 and len(relative) <= 1024
            and not relative.startswith('/') and '..' not in parts
            and str(PurePosixPath(relative)) == relative and relative != '.', 'Private path refused')
    return parts


@contextlib.contextmanager
def file_at(root, relative):
    """Pin every physical parent; a final O_NOFOLLOW alone is insufficient."""
    parts = safe_parts(relative)
    directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in parts[:-1]:
            following = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            os.close(directory)
            directory = following
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        with os.fdopen(fd, 'rb') as stream:
            require(stat.S_ISREG(os.fstat(stream.fileno()).st_mode), 'Regular content file required')
            yield stream, directory, parts[-1]
    finally:
        os.close(directory)


def file_identity(info):
    return (info.st_dev, info.st_ino, info.st_size, stat.S_IMODE(info.st_mode), info.st_mtime_ns)


def stream_digest(source):
    before = os.fstat(source.fileno())
    require(before.st_size <= MAX_BYTES, 'Content file exceeds bound')
    digest, size = hashlib.sha256(), 0
    while chunk := source.read(1024 * 1024):
        size += len(chunk)
        require(size <= before.st_size, 'Content file changed')
        digest.update(chunk)
    after = os.fstat(source.fileno())
    require(size == before.st_size and file_identity(before) == file_identity(after)
            and before.st_ctime_ns == after.st_ctime_ns, 'Content file changed')
    return digest.hexdigest(), after


def build_index(root):
    files, directories, index_bytes = [], [], 64
    for entry in regular_tree(root):
        relative = entry.relative_to(root).as_posix()
        safe_parts(relative)
        if entry.is_dir():
            directories.append(relative)
            index_bytes += len(canonical(relative)) + 1
        else:
            with file_at(root, relative) as (stream, _, __):
                digest, info = stream_digest(stream)
            files.append({'path': relative, 'size': info.st_size, 'sha256': digest,
                          'mode': 0o644, 'mtime': info.st_mtime_ns // 1000000000})
            index_bytes += len(canonical(files[-1])) + 1
        require(index_bytes <= MAX_INDEX_BYTES, 'Private index exceeds bound')
    result = {'schema_version': 2, 'files': sorted(files, key=lambda row: row['path']),
              'directories': sorted(directories)}
    raw = canonical(result)
    parse_index(raw)
    return raw


def parse_index(raw):
    require(0 < len(raw) <= MAX_INDEX_BYTES, 'Private index exceeds bound')
    index = strict_json(raw)
    require(isinstance(index, dict) and set(index) == {'schema_version', 'files', 'directories'}
            and type(index['schema_version']) is int and index['schema_version'] == 2
            and isinstance(index['files'], list) and isinstance(index['directories'], list), 'Private index schema mismatch')
    require(0 < len(index['files']) and len(index['files']) + len(index['directories']) <= MAX_FILES,
            'Private index path bound exceeded')
    seen, total = set(), 0
    for directory in index['directories']:
        safe_parts(directory)
        require(directory not in seen, 'Duplicate private index path')
        seen.add(directory)
    directory_paths = set(seen)
    for row in index['files']:
        require(isinstance(row, dict) and set(row) == {'path', 'size', 'sha256', 'mode', 'mtime'}, 'Private file schema mismatch')
        parts = safe_parts(row['path'])
        require(row['path'] not in seen and type(row['size']) is int and 0 <= row['size'] <= MAX_BYTES
                and type(row['mode']) is int and row['mode'] == 0o644
                and type(row['mtime']) is int and 0 <= row['mtime'] <= 2**53 - 1
                and isinstance(row['sha256'], str) and len(row['sha256']) == 64
                and all(c in '0123456789abcdef' for c in row['sha256']), 'Invalid private file entry')
        require(all('/'.join(parts[:i]) in directory_paths for i in range(1, len(parts))), 'Missing private parent directory')
        seen.add(row['path'])
        total += row['size']
        require(total <= MAX_BYTES, 'Private logical byte bound exceeded')
    for directory in directory_paths:
        parts = safe_parts(directory)
        require(all('/'.join(parts[:i]) in directory_paths for i in range(1, len(parts))), 'Missing private parent directory')
    require(raw == canonical(index), 'Noncanonical private index')
    return index


def content_key(row):
    return row['sha256'], row['size'], row['mode'], row['mtime']


def sync_directory(directory):
    fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


@contextlib.contextmanager
def pinned_sources(package, activation, releases):
    """Caller holds operation_lock until every sealed source has a reader pin."""
    with contextlib.ExitStack() as stack:
        rows = []
        if releases.exists():
            inventory(package, activation, releases, 100 * MAX_BYTES)
            for release in sorted(releases.iterdir()):
                fd = os.open(release / '.reader.lock', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
                reader = stack.enter_context(os.fdopen(fd, 'rb'))
                require(stat.S_ISREG(os.fstat(fd).st_mode), 'Regular source reader lock required')
                fcntl.flock(fd, fcntl.LOCK_SH)
                rows.append((release, activation.sealed_identity(release)))
        yield rows


def source_lookup(rows, index):
    lookup, count, digest, hashed = {}, 0, hashlib.sha256(), {}
    wanted = {(r['size'], r['mode'], r['mtime']) for r in index['files']}
    for release, identity in rows:
        digest.update(canonical(identity))
        root = release / 'dist'
        for entry in regular_tree(root):
            count += 1
            require(count <= MAX_SOURCE_FILES, 'Retained source index bound exceeded')
            relative = entry.relative_to(root).as_posix()
            safe_parts(relative)
            info = entry.lstat()
            digest.update(canonical([release.name, relative, list(file_identity(info)), info.st_ctime_ns]))
            if not stat.S_ISREG(info.st_mode) or info.st_mtime_ns % 1000000000:
                continue
            metadata = (info.st_size, stat.S_IMODE(info.st_mode), info.st_mtime_ns // 1000000000)
            if metadata not in wanted:
                continue
            stamp = (*file_identity(info), info.st_ctime_ns)
            if stamp not in hashed:
                with file_at(root, relative) as (stream, _, __):
                    value, checked = stream_digest(stream)
                    require(file_identity(checked) == file_identity(info), 'Source identity changed')
                    hashed[stamp] = value
            key = (hashed[stamp], *metadata)
            lookup.setdefault(key, (root, relative, file_identity(info)))
    return lookup, digest.hexdigest()


def storage_plan(package, activation, active, releases, raw, expected, budget, reserve, allocated_union, *, sources):
    require(type(budget) is int and budget > 0 and type(reserve) is int and reserve >= BACKEND_RESERVE,
            'Physical budget and unchanged backend reserve required')
    require(activation.current_release() == expected, 'Storage plan CAS refused')
    index = parse_index(raw)
    lookup, sources_digest = source_lookup(sources, index)
    block = os.statvfs(active.parent).f_frsize
    require(0 < block <= 65536, 'Unsupported allocation unit')
    rounded = lambda size: ((size + block - 1) // block) * block
    existing = allocated_union([releases]) if releases.exists() else 0
    distinct = set(lookup)
    incremental = 0
    for row in index['files']:
        key = content_key(row)
        if key not in distinct:
            incremental += rounded(row['size'])
            distinct.add(key)
    # Includes dirents for every path, release/dist/reader and durable plan files.
    directories = (len(index['files']) + len(index['directories']) + 8) * max(4096, block)
    temporary = max(rounded(row['size']) for row in index['files'])
    private = rounded(MAX_INDEX_BYTES) + rounded(16384)
    peak = existing + incremental + directories + temporary + private
    require(peak <= budget, 'Physical managed peak exceeds owner budget')
    plan = {'schema_version': 2, 'expected_current': expected, 'index_sha256': hashlib.sha256(raw).hexdigest(),
            'budget_bytes': budget, 'reserve_bytes': reserve, 'logical_bytes': sum(r['size'] for r in index['files']),
            'physical_bytes': existing, 'incremental_bytes': incremental, 'directory_allowance_bytes': directories,
            'temporary_bytes': temporary, 'private_index_bytes': private, 'peak_bytes': peak,
            'required_free_bytes': peak - existing + reserve, 'sources_sha256': sources_digest}
    plan['plan_sha256'] = hashlib.sha256(canonical(plan)).hexdigest()
    free = os.statvfs(active.parent)
    require(free.f_bavail * free.f_frsize >= plan['required_free_bytes'], 'Physical free space cannot preserve backend reserve')
    return plan, lookup


def transfer_plan(plan, index, lookup):
    """v3 changes the wire set only; the durable allocation plan stays v2."""
    known, required = set(lookup), []
    for row in sorted(index['files'], key=lambda item: item['path']):
        key = content_key(row)
        if key not in known:
            required.append(row['path'])
            known.add(key)
    result = {'schema_version': 3, 'storage_plan': plan, 'required_paths': required}
    result['transfer_plan_sha256'] = hashlib.sha256(canonical(result)).hexdigest()
    require(len(canonical(result)) <= MAX_TRANSFER_PLAN_BYTES, 'Private transfer plan exceeds bound')
    return result


def parse_transfer_plan(raw, index_raw):
    require(0 < len(raw) <= MAX_TRANSFER_PLAN_BYTES, 'Private transfer plan exceeds bound')
    value = strict_json(raw)
    require(isinstance(value, dict) and set(value) == {'schema_version', 'storage_plan', 'required_paths', 'transfer_plan_sha256'}
            and type(value['schema_version']) is int and value['schema_version'] == 3
            and isinstance(value['storage_plan'], dict) and isinstance(value['required_paths'], list),
            'Private transfer plan schema mismatch')
    plan = value['storage_plan']
    require(plan.get('schema_version') == 2 and plan.get('index_sha256') == hashlib.sha256(index_raw).hexdigest()
            and plan.get('plan_sha256') == hashlib.sha256(canonical({k: v for k, v in plan.items() if k != 'plan_sha256'})).hexdigest(),
            'Private transfer storage plan mismatch')
    require(value['transfer_plan_sha256'] == hashlib.sha256(canonical({k: v for k, v in value.items() if k != 'transfer_plan_sha256'})).hexdigest(),
            'Private transfer plan hash mismatch')
    # The sender cannot know retained source bytes. It can still reject aliases,
    # unknown paths and non-deterministic representatives before writing a frame.
    first = {}
    for row in sorted(parse_index(index_raw)['files'], key=lambda item: item['path']):
        first.setdefault(content_key(row), row['path'])
    representatives = set(first.values())
    paths = value['required_paths']
    require(all(isinstance(path, str) and path in representatives for path in paths)
            and paths == sorted(set(paths)), 'Private transfer path set mismatch')
    return value


def verify_tar_tail(archive, compressed):
    # Our tar writers pad one fixed record. Bound expanded padding as well as
    # validating the gzip trailer, so an extra zero stream cannot evade limits.
    buffered = archive.fileobj.buf
    require(len(buffered) <= tarfile.RECORDSIZE and not any(buffered),
            'Unexpected trailing archive content')
    remainder = compressed.read(tarfile.RECORDSIZE - len(buffered) + 1)
    require(len(buffered) + len(remainder) <= tarfile.RECORDSIZE and not any(remainder),
            'Unexpected trailing archive content')


def frame_v3(index_path, plan_path, archive_path, output):
    """Validate the full prepared archive while streaming only new unique bodies."""
    with file_at(index_path.parent, index_path.name) as (source, _, __):
        raw = source.read(MAX_INDEX_BYTES + 1)
    index = parse_index(raw)
    with file_at(plan_path.parent, plan_path.name) as (source, _, __):
        plan_raw = source.read(MAX_TRANSFER_PLAN_BYTES + 1)
    plan = parse_transfer_plan(plan_raw, raw)
    files = {row['path']: row for row in index['files']}
    directories, required, seen = set(index['directories']), set(plan['required_paths']), set()
    output.write(struct.pack('>II', len(raw), len(plan_raw)))
    output.write(raw)
    output.write(plan_raw)
    with file_at(archive_path.parent, archive_path.name) as (source, _, __):
        before = os.fstat(source.fileno())
        require(before.st_size <= MAX_BYTES + MAX_FILES * 4096, 'Compressed archive exceeds transport bound')
        with gzip.GzipFile(fileobj=source, mode='rb') as compressed, \
                tarfile.open(fileobj=compressed, mode='r|') as archive, \
                gzip.GzipFile(fileobj=output, mode='wb', compresslevel=1, mtime=0) as encoded, \
                tarfile.open(fileobj=encoded, mode='w|') as filtered:
            for member in archive:
                relative = '/'.join(safe_parts(member.name))
                require(relative not in seen and (member.isfile() or member.isdir()), 'Archive link/duplicate/special file refused')
                seen.add(relative)
                if member.isdir():
                    require(relative in directories and member.size == 0, 'Archive directory/index mismatch')
                    continue
                row = files.get(relative)
                require(row and member.size == row['size'] and member.mode == row['mode']
                        and member.mtime == row['mtime'], 'Archive metadata/index mismatch')
                with archive.extractfile(member) as body:
                    class VerifiedBody:
                        size = 0
                        digest = hashlib.sha256()

                        def read(self, size=-1):
                            chunk = body.read(size)
                            self.size += len(chunk)
                            self.digest.update(chunk)
                            return chunk

                    checked = VerifiedBody()
                    if relative in required:
                        # Drop inherited PAX data and emit only a regular body.
                        outgoing = tarfile.TarInfo(relative)
                        outgoing.size, outgoing.mode, outgoing.mtime = row['size'], row['mode'], row['mtime']
                        filtered.addfile(outgoing, checked)
                    else:
                        while checked.read(1024 * 1024):
                            pass
                    require(checked.size == row['size'] and checked.digest.hexdigest() == row['sha256'],
                            'Archive content/index mismatch')
            require(seen == set(files) | directories, 'Archive omitted indexed paths')
            verify_tar_tail(archive, compressed)
        after = os.fstat(source.fileno())
        require(file_identity(before) == file_identity(after) and before.st_ctime_ns == after.st_ctime_ns,
                'Prepared archive changed during filtering')


def write_private(path, raw):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    sync_directory(path.parent)


def materialize(root, archive_stream, raw, lookup, plan, allocated_union, releases):
    index = parse_index(raw)
    files = {row['path']: row for row in index['files']}
    directories, seen = set(index['directories']), set()
    copied_blocks = 0
    block = os.statvfs(releases).f_frsize
    rounded = lambda size: ((size + block - 1) // block) * block
    overhead = plan['physical_bytes'] + plan['directory_allowance_bytes'] + plan['private_index_bytes']
    def headroom(incoming=0, temporary_blocks=0):
        free = os.statvfs(releases)
        require(free.f_bavail * free.f_frsize >= plan['reserve_bytes'] + incoming,
                'Staging stopped before consuming backend reserve')
        require(overhead + copied_blocks + temporary_blocks <= plan['budget_bytes'],
                'Staging physical allocation exceeds owner budget')
    headroom(plan['required_free_bytes'] - plan['reserve_bytes'])
    for relative in sorted(directories, key=lambda value: (len(safe_parts(value)), value)):
        headroom(max(4096, os.statvfs(releases).f_frsize))
        root.joinpath(*safe_parts(relative)).mkdir()
    with tarfile.open(fileobj=archive_stream, mode='r|gz') as archive:
        for member in archive:
            parts = safe_parts(member.name)
            relative = '/'.join(parts)
            require(relative not in seen and (member.isfile() or member.isdir()), 'Archive link/duplicate/special file refused')
            seen.add(relative)
            target = root.joinpath(*parts)
            require(target.parent.resolve() == target.parent, 'Archive parent link refused')
            if member.isdir():
                require(relative in directories and member.size == 0, 'Archive directory/index mismatch')
                continue
            row = files.get(relative)
            require(row and member.size == row['size'] and member.mode == row['mode']
                    and member.mtime == row['mtime'], 'Archive metadata/index mismatch')
            temporary = root.parent / '.storage-member.v2.tmp'
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            try:
                digest, size = hashlib.sha256(), 0
                with os.fdopen(fd, 'wb') as output, archive.extractfile(member) as source:
                    remaining = member.size
                    while remaining:
                        chunk = source.read(min(remaining, 1024 * 1024))
                        require(chunk, 'Truncated archive')
                        headroom(len(chunk), rounded(size + len(chunk)))
                        output.write(chunk)
                        output.flush()
                        size += len(chunk)
                        headroom(temporary_blocks=os.fstat(output.fileno()).st_blocks * 512)
                        digest.update(chunk)
                        remaining -= len(chunk)
                    output.flush()
                    require(size == row['size'] and digest.hexdigest() == row['sha256'], 'Archive content/index mismatch')
                    os.fchmod(output.fileno(), row['mode'])
                    os.utime(output.fileno(), ns=(row['mtime'] * 1000000000,) * 2)
                    os.fsync(output.fileno())
                key = content_key(row)
                if key in lookup:
                    source_root, source_relative, expected_identity = lookup[key]
                    with file_at(source_root, source_relative) as (source, parent, name):
                        value, checked = stream_digest(source)
                        require(value == row['sha256'] and file_identity(checked) == expected_identity,
                                'Sealed source bytes or identity changed')
                        named = os.stat(name, dir_fd=parent, follow_symlinks=False)
                        require(file_identity(named) == file_identity(checked) and named.st_ctime_ns == checked.st_ctime_ns,
                                'Sealed source path changed')
                        os.link(name, target, src_dir_fd=parent, follow_symlinks=False)
                        require(file_identity(target.lstat()) == expected_identity, 'Linked source identity changed')
                        os.fsync(source.fileno())
                    os.unlink(temporary)
                else:
                    os.rename(temporary, target)
                    checked = target.lstat()
                    copied_blocks += checked.st_blocks * 512
                    lookup[key] = (root, relative, file_identity(checked))
                sync_directory(target.parent)
                headroom()
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
    require(seen == set(files) | directories, 'Archive omitted indexed paths')
    for directory in sorted(directories, key=lambda value: len(safe_parts(value)), reverse=True):
        sync_directory(root / directory)
    sync_directory(root)
    sync_directory(root.parent)


@contextlib.contextmanager
def parent_at(root, relative):
    parts = safe_parts(relative)
    directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in parts[:-1]:
            following = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            os.close(directory)
            directory = following
        yield directory, parts[-1]
    finally:
        os.close(directory)


def link_content(root, relative, row, source_entry):
    source_root, source_relative, expected_identity = source_entry
    with file_at(source_root, source_relative) as (source, parent, name), parent_at(root, relative) as (target_parent, target_name):
        value, checked = stream_digest(source)
        require(value == row['sha256'] and file_identity(checked) == expected_identity,
                'Sealed source bytes or identity changed')
        named = os.stat(name, dir_fd=parent, follow_symlinks=False)
        require(file_identity(named) == file_identity(checked) and named.st_ctime_ns == checked.st_ctime_ns,
                'Sealed source path changed')
        os.link(name, target_name, src_dir_fd=parent, dst_dir_fd=target_parent, follow_symlinks=False)
        linked = os.stat(target_name, dir_fd=target_parent, follow_symlinks=False)
        require(file_identity(linked) == expected_identity, 'Linked source identity changed')
        os.fsync(source.fileno())
        os.fsync(target_parent)


def materialize_v3(root, archive_stream, raw, lookup, transfer, releases):
    index = parse_index(raw)
    plan = transfer['storage_plan']
    files = {row['path']: row for row in index['files']}
    required, seen = set(transfer['required_paths']), set()
    copied_blocks = 0
    block = os.statvfs(releases).f_frsize
    rounded = lambda size: ((size + block - 1) // block) * block
    overhead = plan['physical_bytes'] + plan['directory_allowance_bytes'] + plan['private_index_bytes']

    def headroom(incoming=0, temporary_blocks=0):
        free = os.statvfs(releases)
        require(free.f_bavail * free.f_frsize >= plan['reserve_bytes'] + incoming,
                'Staging stopped before consuming backend reserve')
        require(overhead + copied_blocks + temporary_blocks <= plan['budget_bytes'],
                'Staging physical allocation exceeds owner budget')

    headroom(plan['required_free_bytes'] - plan['reserve_bytes'])
    for relative in sorted(index['directories'], key=lambda value: (len(safe_parts(value)), value)):
        headroom(max(4096, block))
        with parent_at(root, relative) as (parent, name):
            os.mkdir(name, dir_fd=parent)
    # Reading gzip through EOF verifies its CRC/trailer even after tar's end marker.
    with gzip.GzipFile(fileobj=archive_stream, mode='rb') as compressed, tarfile.open(fileobj=compressed, mode='r|') as archive:
        for member in archive:
            relative = '/'.join(safe_parts(member.name))
            require(relative in required and relative not in seen and member.isfile(),
                    'Delta archive path/link/duplicate/special file refused')
            seen.add(relative)
            row = files[relative]
            require(member.size == row['size'] and member.mode == row['mode']
                    and member.mtime == row['mtime'], 'Delta archive metadata/index mismatch')
            temporary = root.parent / '.storage-member.v2.tmp'
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            try:
                digest, size = hashlib.sha256(), 0
                with os.fdopen(fd, 'wb') as output, archive.extractfile(member) as source:
                    remaining = member.size
                    while remaining:
                        chunk = source.read(min(remaining, 1024 * 1024))
                        require(chunk, 'Truncated delta archive')
                        headroom(len(chunk), rounded(size + len(chunk)))
                        output.write(chunk)
                        output.flush()
                        size += len(chunk)
                        headroom(temporary_blocks=os.fstat(output.fileno()).st_blocks * 512)
                        digest.update(chunk)
                        remaining -= len(chunk)
                    require(size == row['size'] and digest.hexdigest() == row['sha256'], 'Delta archive content/index mismatch')
                    os.fchmod(output.fileno(), row['mode'])
                    os.utime(output.fileno(), ns=(row['mtime'] * 1000000000,) * 2)
                    os.fsync(output.fileno())
                with parent_at(root, relative) as (parent, name):
                    # Target is absent in this exclusively owned new generation.
                    require(not os.path.lexists(root / relative), 'Delta target already exists')
                    os.rename(temporary, name, dst_dir_fd=parent)
                    checked = os.stat(name, dir_fd=parent, follow_symlinks=False)
                    copied_blocks += checked.st_blocks * 512
                    lookup[content_key(row)] = (root, relative, file_identity(checked))
                    os.fsync(parent)
                headroom()
            finally:
                if os.path.lexists(temporary):
                    os.unlink(temporary)
        require(seen == required, 'Delta archive omitted required paths')
        verify_tar_tail(archive, compressed)
    for row in sorted(index['files'], key=lambda item: item['path']):
        if row['path'] not in required:
            key = content_key(row)
            require(key in lookup, 'Delta source missing')
            headroom()
            link_content(root, row['path'], row, lookup[key])
    for directory in sorted(index['directories'], key=lambda value: len(safe_parts(value)), reverse=True):
        sync_directory(root / directory)
    sync_directory(root)
    sync_directory(root.parent)


@contextlib.contextmanager
def legacy_lock(root, *, root_cleanup=False):
    # Also works before the backend contract is deployed; same path, UID and
    # flock as operation_lock(). The active type is rechecked under the lock.
    require(root.is_dir() and not root.is_symlink(), "Static parent must exist")
    require(os.geteuid() == root.stat().st_uid or (root_cleanup and os.geteuid() == 0), "Operation must use the static owner UID")
    flags = os.O_RDWR | os.O_NOFOLLOW
    if not root_cleanup:
        flags |= os.O_CREAT
    fd = os.open(root / '.quest-seo-operation.lock', flags, 0o600)
    with os.fdopen(fd, 'rb') as lock:
        require(stat.S_ISREG(os.fstat(lock.fileno()).st_mode), "Regular lock required")
        fcntl.flock(lock, fcntl.LOCK_EX)
        require(not (root / 'dist').is_symlink(), "Managed root: use the normal v1 deploy/rollback")
        yield


def legacy_identity(root):
    active = root / 'dist'
    if not active.exists():
        return 'none'
    require(active.is_dir() and not active.is_symlink(), 'Legacy directory required')
    info = active.stat()
    return f'{info.st_dev}:{info.st_ino}'


def legacy_operation(action, arguments):
    root = Path('/app/static')
    with legacy_lock(root, root_cleanup=action in ('legacy-prune', 'legacy-prepare', 'legacy-chunk')):
        if action == 'legacy-check':
            print(legacy_identity(root))
            return
        expected, *extra = arguments
        require(legacy_identity(root) == expected, 'Legacy CAS refused')
        active, staged, old = root / 'dist', root / 'dist.new', root / 'dist.old'
        if action == 'legacy-commit':
            require(staged.is_dir() and not staged.is_symlink() and not old.exists() and not old.is_symlink(), 'Unsafe legacy staging')
            if active.exists():
                active.rename(old)
            try:
                staged.rename(active)
            except OSError:
                if not active.exists() and old.is_dir():
                    old.rename(active)
                raise
            print(legacy_identity(root))
        elif action == 'legacy-rollback':
            require(old.is_dir() and not old.is_symlink(), 'Prior legacy tree missing')
            rejected = root / ('dist.failed.' + str(os.getpid()))
            active.rename(rejected)
            try:
                old.rename(active)
            except OSError:
                rejected.rename(active)
                raise
            # Retain failed bytes for owner inspection; no deletion after rollback.
            print(legacy_identity(root))
        elif action in ('legacy-prune', 'legacy-prepare'):
            for entry in root.iterdir():
                if entry.name in ('dist.new', 'dist.old') or entry.name.startswith(('dist.old-', 'dist.old.stale-', 'dist.failed.')):
                    require(entry.is_dir() and not entry.is_symlink(), 'Unknown legacy leftover')
                    shutil.rmtree(entry)
            if action == 'legacy-prepare':
                uid, gid = (int(value) for value in extra)
                require(uid > 0 and gid > 0, 'Host staging owner required')
                staged.mkdir()
                os.chown(staged, uid, gid)
        elif action == 'legacy-chunk':
            new, old_name = extra
            require(all('/' not in name and name.endswith('.js') and '..' not in name for name in extra), 'Chunk name refused')
            directory = active / '_expo/static/js/web'
            require(directory.resolve() == directory, 'Chunk directory link refused')
            source, target = directory / new, directory / old_name
            require(source.is_file() and not source.is_symlink() and not target.is_symlink(), 'Chunk file refused')
            # nginx prefers `<name>.br` (brotli_static); a copy of the old bytes would shadow the new chunk.
            compressed = directory / (old_name + '.br')
            require(not compressed.is_symlink(), 'Chunk file refused')
            compressed.unlink(missing_ok=True)
            shutil.copyfile(source, target)
        else:
            raise ValueError('Unknown legacy action')


def inventory(package, activation, releases, budget, incoming=0):
    require(budget > 0 and incoming >= 0, 'Owner-selected managed byte budget required')
    total, count = 0, 0
    if releases.exists():
        require(releases.is_dir() and not releases.is_symlink(), 'Physical releases directory required')
        for release in releases.iterdir():
            package._match(package.SLUG, release.name)
            require(release.is_dir() and not release.is_symlink(), 'Unknown generation')
            identity = activation.sealed_identity(release)  # Unknown/in-flight/unsealed fails the whole operation.
            package.regular_file(release, '.reader.lock', 4096)
            built = package.QuestSeoPackage(release / 'dist', release.name, validate_all=True)
            require(identity['release_id'] == release.name and identity['frontend_sha'] == built.manifest['frontend_sha']
                    and identity['manifest_sha256'] == built.manifest_sha256, 'Generation identity mismatch')
            tree_hash, size = activation.tree_identity(built.root)
            require(tree_hash == identity['tree_sha256'], 'Corrupt generation')
            total += size
            count += 1
            require(count <= 100 and total + incoming <= budget, 'Managed inventory budget exceeded')
    require(total + incoming <= budget, 'Managed inventory budget exceeded')
    return {'schema_version': 1, 'release_count': count, 'total_bytes': total}


def physical_inventory(package, activation, releases, budget, allocated_union):
    result = inventory(package, activation, releases, 100 * MAX_BYTES)
    allocated = allocated_union([releases]) if releases.exists() else 0
    require(budget > 0 and allocated <= budget, 'Managed physical inventory budget exceeded')
    return {**result, 'schema_version': 2, 'allocated_bytes': allocated, 'budget_bytes': budget}


def read_exact(stream, size):
    chunks, remaining = [], size
    while remaining:
        chunk = stream.read(remaining)
        require(chunk, 'Truncated private staging frame')
        chunks.append(chunk)
        remaining -= len(chunk)
    return b''.join(chunks)


def stage_v2(package, activation, active, releases, arguments, allocated_union):
    return stage(package, activation, active, releases, arguments, allocated_union, version=2)


def stage_v3(package, activation, active, releases, arguments, allocated_union):
    return stage(package, activation, active, releases, arguments, allocated_union, version=3)


def stage(package, activation, active, releases, arguments, allocated_union, *, version):
    release_id, expected_id, budget, reserve = arguments
    package._match(package.SLUG, release_id)
    expected = None if expected_id == 'none' else expected_id
    index_size, plan_size = struct.unpack('>II', read_exact(sys.stdin.buffer, 8))
    require(0 < index_size <= MAX_INDEX_BYTES and 0 < plan_size <= (MAX_TRANSFER_PLAN_BYTES if version == 3 else 16384),
            'Private staging frame exceeds bound')
    raw = read_exact(sys.stdin.buffer, index_size)
    plan_raw = read_exact(sys.stdin.buffer, plan_size)
    supplied = parse_transfer_plan(plan_raw, raw) if version == 3 else strict_json(plan_raw)
    with contextlib.ExitStack() as pins:
        with package.operation_lock():
            sources = pins.enter_context(pinned_sources(package, activation, releases))
            plan, lookup = storage_plan(package, activation, active, releases, raw, expected,
                                        int(budget), int(reserve), allocated_union, sources=sources)
            transfer = transfer_plan(plan, parse_index(raw), lookup) if version == 3 else None
            require(supplied == (transfer if version == 3 else plan), 'Storage plan changed; rebuild plan before transfer')
            releases.mkdir(exist_ok=True)
            release = releases / release_id
            release.mkdir()  # An unknown or partial candidate is never swept/reused.
            fd = os.open(release / '.reader.lock', os.O_CREAT | os.O_EXCL | os.O_RDWR | os.O_NOFOLLOW, 0o600)
            reader = pins.enter_context(os.fdopen(fd, 'rb'))
            fcntl.flock(fd, fcntl.LOCK_SH)
            write_private(release / INDEX_NAME, raw)
            write_private(release / '.storage-plan.v2.json', canonical(plan))
            root = release / 'dist'
            root.mkdir()
            sync_directory(releases)
        if version == 3:
            materialize_v3(root, sys.stdin.buffer, raw, lookup, transfer, releases)
        else:
            materialize(root, sys.stdin.buffer, raw, lookup, plan, allocated_union, releases)
        if expected is None:
            baseline = package.QuestSeoPackage(root, release_id, validate_all=True)
            require(all(set(cluster['members']) == {'ru'} for cluster in baseline.manifest['clusters']),
                    'First v1 generation must be RU-only')
        with package.operation_lock():
            require(activation.current_release() == expected, 'Staging completion CAS refused')
            allocated = allocated_union([releases])
            require(allocated <= plan['budget_bytes'], 'Actual managed allocation exceeds owner budget')
        result = {'schema_version': version, 'release_id': release_id, 'result': 'staged',
                  'index_sha256': plan['index_sha256'], 'plan_sha256': plan['plan_sha256'],
                  'allocated_bytes': allocated}
        if version == 3:
            result['transfer_plan_sha256'] = transfer['transfer_plan_sha256']
            # Private diagnostics only: Linux reports KiB, Darwin reports bytes.
            result['max_rss_bytes'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024)
        return result


def abort_stage_v2(package, activation, active, releases, arguments):
    """Explicit hash-bound removal of one interrupted candidate; never a sweep."""
    release_id, expected_id, index_hash, plan_hash = arguments
    package._match(package.SLUG, release_id)
    expected = None if expected_id == 'none' else expected_id
    with package.operation_lock():
        current = activation.current_release()
        require(current == expected, 'Abort staging CAS refused')
        prior = activation.retained_rollback(current)
        require(release_id not in {current, prior}, 'Cannot abort active or rollback generation')
        release = releases / release_id
        require(release.resolve(strict=True) == release and release.is_dir(), 'Physical candidate required')
        require(not (release / '.identity.json').exists() and not (release / '.identity.json').is_symlink(),
                'Cannot abort sealed generation')
        with file_at(release, '.reader.lock') as (reader, _, __):
            fcntl.flock(reader.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            raw = package.regular_file(release, INDEX_NAME, MAX_INDEX_BYTES)
            index = parse_index(raw)
            plan_raw = package.regular_file(release, '.storage-plan.v2.json', 16384)
            plan = strict_json(plan_raw)
            require(hashlib.sha256(raw).hexdigest() == index_hash and isinstance(plan, dict)
                    and plan.get('schema_version') == 2 and plan.get('expected_current') == expected
                    and plan.get('index_sha256') == index_hash and plan.get('plan_sha256') == plan_hash
                    and hashlib.sha256(canonical({k: v for k, v in plan.items() if k != 'plan_sha256'})).hexdigest() == plan_hash,
                    'Abort private provenance mismatch')
            allowed = {'.reader.lock', INDEX_NAME, '.storage-plan.v2.json', '.storage-member.v2.tmp', 'dist'}
            require({p.name for p in release.iterdir()} <= allowed, 'Unknown candidate entry; owner inspection required')
            for name, maximum in [('.reader.lock', 4096), (INDEX_NAME, MAX_INDEX_BYTES), ('.storage-plan.v2.json', 16384)]:
                info = (release / name).lstat()
                require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size <= maximum,
                        'Unsafe private candidate entry')
            temporary = release / '.storage-member.v2.tmp'
            if temporary.exists() or temporary.is_symlink():
                info = temporary.lstat()
                require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1
                        and info.st_size <= max(row['size'] for row in index['files']), 'Unsafe private staging member')
            root = release / 'dist'
            require(root.is_dir() and root.resolve(strict=True) == root, 'Physical candidate dist required')
            files = {row['path']: row for row in index['files']}
            directories = set(index['directories'])
            for entry in regular_tree(root):
                relative = entry.relative_to(root).as_posix()
                if entry.is_dir():
                    require(relative in directories, 'Unknown candidate directory')
                    continue
                row = files.get(relative)
                require(row is not None, 'Unknown candidate content')
                with file_at(root, relative) as (source, _, __):
                    digest, info = stream_digest(source)
                    require((digest, info.st_size, stat.S_IMODE(info.st_mode), info.st_mtime_ns)
                            == (row['sha256'], row['size'], row['mode'], row['mtime'] * 1000000000),
                            'Candidate content does not match private index')
            # The EX reader pin and operation lock stay held through removal.
            shutil.rmtree(release)
            sync_directory(releases)
        return {'schema_version': 2, 'result': 'aborted', 'release_id': release_id,
                'index_sha256': index_hash, 'plan_sha256': plan_hash}


def backend():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'metravel.settings')
    import django
    django.setup()
    from quests.services import seo_package, seo_activation
    active, releases = seo_package.configured_roots()
    require(active == Path('/app/static/dist'), "Unexpected app serving root")
    require(os.geteuid() == active.parent.stat().st_uid, "Operation must use the static owner UID")
    return seo_package, seo_activation, active, releases


def describe(package, activation, active, releases):
    kind = 'managed' if active.is_symlink() else 'legacy' if active.exists() else 'absent'
    result = {'schema_version': 1, 'kind': kind, 'current': None, 'previous': None}
    if kind == 'managed':
        current = activation.current_release()
        result['current'] = activation.sealed_identity(releases / current)
        prior = activation.retained_rollback(current)
        if prior:
            result['previous'] = activation.sealed_identity(releases / prior)
    # Names only, no validation: the publisher skips a pre-staging cleanup that
    # could not remove anything (#2448). Every check that cleanup would run on
    # these generations is repeated by the transfer plan's sealed inventory.
    names = []
    if releases.exists():
        require(releases.is_dir() and not releases.is_symlink(), 'Physical releases directory required')
        for release in releases.iterdir():
            package._match(package.SLUG, release.name)
            names.append(release.name)
            require(len(names) <= 100, 'Managed generation count exceeds bound')
    result['generations'] = sorted(names)
    return result


def publish_cover(package, activation, active, releases, arguments):
    release_id, sha, manifest_hash = arguments
    package._match(package.SLUG, release_id)
    with package.operation_lock():
        require(activation.current_release() == release_id, 'Shared cover CAS refused')
        identity = activation.sealed_identity(releases / release_id)
        require(identity['frontend_sha'] == sha and identity['manifest_sha256'] == manifest_hash, 'Shared cover identity mismatch')
        data = package.regular_file(releases / release_id / 'dist', 'static/quests/quest-default-cover.svg', 1024 * 1024)
        require(data, 'Shared quest cover missing or empty')
        directory = active.parent / 'quests'
        target = directory / 'quest-default-cover.svg'
        require(directory.resolve() == directory and not directory.is_symlink(), 'Shared cover directory link refused')
        require(not target.is_symlink() and (not target.exists() or target.is_file()), 'Shared cover target refused')
        directory.mkdir(exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix='.quest-default-cover.', dir=directory)
        try:
            with os.fdopen(fd, 'wb') as output:
                os.fchmod(output.fileno(), 0o644)
                output.write(data)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, target)
            parent = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(parent)
            finally:
                os.close(parent)
            require(package.regular_file(active.parent, 'quests/quest-default-cover.svg', 1024 * 1024) == data, 'Shared cover bytes mismatch')
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
        return {'schema_version': 1, 'result': 'published', 'release_id': release_id, 'sha256': hashlib.sha256(data).hexdigest()}


def main():
    action = sys.argv[1]
    arguments = sys.argv[2:]
    if action == 'static-preflight':
        static_preflight(*arguments)
        return
    if action == 'size':
        print(sum(entry.stat().st_size for entry in regular_tree(Path(arguments[0]).absolute()) if entry.is_file()))
        return
    if action == 'hash':
        digest = hashlib.sha256()
        with open(arguments[0], 'rb') as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(chunk)
        print(digest.hexdigest())
        return
    if action == 'index-v2':
        raw = build_index(Path(arguments[0]).absolute())
        write_private(Path(arguments[1]).absolute(), raw)
        print(hashlib.sha256(raw).hexdigest())
        return
    if action == 'frame-v2':
        index_path, plan_path, archive_path = map(Path, arguments)
        with index_path.open('rb') as source:
            raw = source.read(MAX_INDEX_BYTES + 1)
        parse_index(raw)
        with plan_path.open('rb') as source:
            plan = source.read(16385)
        require(0 < len(plan) <= 16384, 'Private plan exceeds bound')
        require(archive_path.stat().st_size <= MAX_BYTES + MAX_FILES * 4096, 'Compressed archive exceeds transport bound')
        sys.stdout.buffer.write(struct.pack('>II', len(raw), len(plan)))
        sys.stdout.buffer.write(raw)
        sys.stdout.buffer.write(plan)
        with archive_path.open('rb') as source:
            shutil.copyfileobj(source, sys.stdout.buffer, 1024 * 1024)
        return
    if action == 'frame-v3':
        frame_v3(*map(lambda value: Path(value).absolute(), arguments), sys.stdout.buffer)
        return
    if action in ('pack', 'unpack'):
        (pack if action == 'pack' else unpack)(Path(arguments[0]).absolute())
        return
    if action.startswith('legacy-'):
        legacy_operation(action, arguments)
        return
    package, activation, active, releases = backend()
    if action in ('inventory-v2', 'storage-plan-v2', 'stage-v2', 'transfer-plan-v3', 'stage-v3'):
        from quests.services.seo_storage import allocated_union
    if action == 'receipt':
        from django.core.management import call_command
        output = io.StringIO()
        call_command('quest_seo_revision_receipt', stdout=output)
        sys.stdout.write(output.getvalue())
    elif action == 'inspect':
        with package.operation_lock():
            print(json.dumps(describe(package, activation, active, releases)))
    elif action == 'inventory':
        with package.operation_lock():
            print(json.dumps(inventory(package, activation, releases, int(arguments[0]), int(arguments[1]))))
    elif action == 'inventory-v2':
        with package.operation_lock():
            print(json.dumps(physical_inventory(package, activation, releases, int(arguments[0]), allocated_union)))
    elif action == 'retain-v2':
        from quests.services.seo_activation import cleanup_releases
        expected, budget = arguments
        # cleanup_releases owns its lock and revalidates active/rollback/readers.
        result = cleanup_releases(keep_releases=2, max_bytes=2 * MAX_BYTES,
                                  max_allocated_bytes=int(budget), expected_current=expected, apply=True)
        require(result['active_release_id'] == expected, 'Retention current changed')
        print(json.dumps(result))
    elif action in ('storage-plan-v2', 'transfer-plan-v3'):
        expected_id, budget, reserve = arguments
        raw = sys.stdin.buffer.read(MAX_INDEX_BYTES + 1)
        with package.operation_lock(), pinned_sources(package, activation, releases) as sources:
            plan, lookup = storage_plan(package, activation, active, releases, raw,
                                   None if expected_id == 'none' else expected_id,
                                   int(budget), int(reserve), allocated_union, sources=sources)
            print(json.dumps(transfer_plan(plan, parse_index(raw), lookup) if action == 'transfer-plan-v3' else plan))
    elif action == 'stage-v2':
        print(json.dumps(stage_v2(package, activation, active, releases, arguments, allocated_union)))
    elif action == 'stage-v3':
        print(json.dumps(stage_v3(package, activation, active, releases, arguments, allocated_union)))
    elif action == 'abort-stage-v2':
        print(json.dumps(abort_stage_v2(package, activation, active, releases, arguments)))
    elif action == 'cover':
        print(json.dumps(publish_cover(package, activation, active, releases, arguments)))
    elif action == 'overlay':
        expected_kind, expected_id = arguments
        if expected_kind == 'managed':
            with package.pin_package() as pinned:
                require(pinned.release_id == expected_id, "Overlay current changed")
                root = pinned.root / '_expo/static'
                require(root.is_dir() and not root.is_symlink(), "Expo assets missing")
                pack(root, assets=True)
        else:
            with legacy_lock(active.parent):
                require(expected_kind == ('legacy' if active.exists() else 'absent'), "Overlay root changed")
                if active.exists():
                    pack(active / '_expo/static', assets=True)
                else:
                    with tarfile.open(fileobj=sys.stdout.buffer, mode='w|gz'):
                        pass
    elif action in ('validate', 'activate'):
        # The management command acquires operation_lock itself, no outer flock.
        from django.core.management import call_command
        release_id, sha, expected_id = arguments
        output = io.StringIO()
        call_command('quest_seo_activate', release_id=release_id, frontend_sha=sha,
                     expected_current=expected_id, validate_only=action == 'validate', stdout=output)
        sys.stdout.write(output.getvalue())
    else:
        raise ValueError('Unknown operation')


if __name__ == '__main__':
    main()
