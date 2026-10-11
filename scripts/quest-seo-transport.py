#!/usr/bin/env python3
"""Private E transport over the existing SSH/app channel; never a serving API."""
import contextlib
import fcntl
import io
import hashlib
import json
import os
import shutil
from pathlib import Path, PurePosixPath
import stat
import sys
import tarfile
import tempfile

MAX_FILES = 50000
MAX_BYTES = 2 * 1024 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


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


def pack(root, *, assets=False):
    with tarfile.open(fileobj=sys.stdout.buffer, mode="w|gz", dereference=True) as archive:
        for entry in regular_tree(root):
            if assets and entry.suffix not in ('.js', '.css'):
                continue
            archive.add(entry, arcname=entry.relative_to(root).as_posix(), recursive=False)


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
    if action in ('pack', 'unpack'):
        (pack if action == 'pack' else unpack)(Path(arguments[0]).absolute())
        return
    if action.startswith('legacy-'):
        legacy_operation(action, arguments)
        return
    package, activation, active, releases = backend()
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
    elif action == 'stage':
        release_id, expected_id, budget, incoming = arguments
        package._match(package.SLUG, release_id)
        with package.operation_lock():
            require(activation.current_release() == (None if expected_id == 'none' else expected_id), "Staging CAS refused")
            inventory(package, activation, releases, int(budget), int(incoming))
            releases.mkdir(exist_ok=True)
            release = releases / release_id
            release.mkdir()  # Never overwrite/reuse an ID or remove an incomplete generation.
            fd = os.open(release / '.reader.lock', os.O_CREAT | os.O_EXCL | os.O_RDWR | os.O_NOFOLLOW, 0o600)
            reader = os.fdopen(fd, 'rb')
            fcntl.flock(reader, fcntl.LOCK_SH)
            root = release / 'dist'
            root.mkdir()
        try:
            unpack(root)
            if expected_id == 'none':
                baseline = package.QuestSeoPackage(root, release_id, validate_all=True)
                require(all(set(cluster['members']) == {'ru'} for cluster in baseline.manifest['clusters']),
                        'First v1 generation must be RU-only')
        finally:
            reader.close()
        print(json.dumps({'schema_version': 1, 'release_id': release_id, 'result': 'staged'}))
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
