#!/usr/bin/env python3
"""Refuse to let credentials or key material into the repository.

    python3 tools/check_secrets.py            # scan every tracked and untracked (non-ignored) file
    python3 tools/check_secrets.py --staged   # scan what is about to be committed (pre-commit hook)
    python3 tools/check_secrets.py --history  # scan every commit ever made on every branch

Blocks: key material of any kind (private AND public keys, certificates), API tokens of the
common providers, passwords or tokens assigned in code, credentials inside URLs, and files whose
name says they hold secrets. Exit code 1 if anything is found; findings never print the secret.
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BAD_NAMES = re.compile(r'(^|/)(\.env(\..*)?|\.npmrc|\.netrc|\.pypirc|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|credentials?(\.json|\.ya?ml)?|'
                       r'secrets?(\.json|\.ya?ml|\.txt)?|.*\.(pem|key|p12|pfx|jks|keystore|ppk|asc|gpg|kdbx))$', re.I)
PATTERNS = [
    ('key block', re.compile(r'-----BEGIN [A-Z0-9 ]*(PRIVATE KEY|PUBLIC KEY|CERTIFICATE|PGP [A-Z ]+)-----')),
    ('ssh public key', re.compile(r'\b(ssh-(rsa|dss|ed25519)|ecdsa-sha2-nistp\d+) AAAA[0-9A-Za-z+/]{40,}')),
    ('AWS access key', re.compile(r'\b(AKIA|ASIA)[0-9A-Z]{16}\b')),
    ('GitHub token', re.compile(r'\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b')),
    ('Anthropic key', re.compile(r'\bsk-ant-[A-Za-z0-9_-]{20,}')),
    ('OpenAI-style key', re.compile(r'\bsk-(proj-)?[A-Za-z0-9_-]{32,}')),
    ('xAI key', re.compile(r'\bxai-[A-Za-z0-9]{32,}')),
    ('Google API key', re.compile(r'\bAIza[0-9A-Za-z_-]{35}\b')),
    ('Slack token', re.compile(r'\bxox[abprs]-[A-Za-z0-9-]{10,}')),
    ('Stripe key', re.compile(r'\b[sr]k_(live|test)_[A-Za-z0-9]{20,}')),
    ('JWT', re.compile(r'\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}')),
    ('credentials in URL', re.compile(r'\b[a-z][a-z0-9+.-]*://[^/\s:@\'"]+:[^/\s:@\'"]+@[^\s\'"]+')),
    ('assigned secret', re.compile(r'(?i)\b(api[_-]?key|secret|passw(or)?d|auth[_-]?token|access[_-]?token|private[_-]?key)\b["\']?\s*[:=]\s*["\'][^"\'\s]{12,}["\']')),
]


def git(*args):
    return subprocess.run(['git', '-C', ROOT] + list(args), capture_output=True, text=True, errors='replace').stdout


def scan_text(where, text, found):
    for lineno, line in enumerate(text.split('\n'), 1):
        if len(line) > 20000:
            line = line[:20000]            # minified bundles: the patterns above still match early in a line
        for label, rx in PATTERNS:
            if rx.search(line):
                found.append('%s:%d  %s' % (where, lineno, label))


def main():
    found, mode = [], (sys.argv[1] if len(sys.argv) > 1 else '')
    if mode == '--staged':
        names = [n for n in git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n') if n]
        for n in names:
            if BAD_NAMES.search(n):
                found.append('%s  file name looks like a secrets file' % n)
            scan_text(n, git('show', ':' + n), found)
    elif mode == '--history':
        for n in set(git('log', '--all', '--name-only', '--pretty=format:').split('\n')):
            if n and BAD_NAMES.search(n):
                found.append('%s  file name looks like a secrets file (in history)' % n)
        for rev in git('rev-list', '--all').split():
            scan_text('commit ' + rev[:8], '\n'.join(l[1:] for l in git('show', rev, '--format=%an %ae%n%B', '--unified=0').split('\n') if l.startswith('+') or not l.startswith(('-', '@', 'diff', 'index'))), found)
    else:
        names = [n for n in git('ls-files', '--cached', '--others', '--exclude-standard').split('\n') if n]
        for n in names:
            if BAD_NAMES.search(n):
                found.append('%s  file name looks like a secrets file' % n)
            try:
                with open(os.path.join(ROOT, n), encoding='utf-8', errors='replace') as f:
                    scan_text(n, f.read(), found)
            except OSError:
                pass
    if found:
        print('BLOCKED: possible credentials or key material:', file=sys.stderr)
        for f in sorted(set(found)):
            print('  ' + f, file=sys.stderr)
        print('Remove them (and rotate anything that was ever committed) before committing or pushing.', file=sys.stderr)
        sys.exit(1)
    print('check_secrets: clean (%s)' % (mode or 'working tree'))


if __name__ == '__main__':
    main()
