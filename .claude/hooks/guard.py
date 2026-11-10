#!/usr/bin/env python3
"""Claude Code PreToolUse hook for this repo. Reads the tool call as JSON on stdin and
exits 2 (block, reason on stderr) when the call would:

  * install packages                    npm/yarn/pnpm/bun install, npx, pip/pipx/uv install, apt, brew, gem, cargo, go install
  * escalate privileges                 sudo, su, doas
  * download or pipe code into a shell  curl, wget, anything piped into sh/bash/zsh, sh <(...), eval "$(...)"
  * read or use credentials             .env, keys, ~/.ssh, ~/.aws, token files, secret env vars, tokens in URLs
  * fetch a URL with tracking parameters (WebFetch): the reason carries the cleaned URL to use instead

Exit 0 = no decision, the normal permission flow applies. Rules are also listed in CLAUDE.md.
"""
import json, os, re, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tools'))

INSTALL = re.compile(r'(?<![\w./-])(npm\s+(i|install|ci|add|update|upgrade|exec)\b|npx\s|yarn(\s+(add|install|dlx|up)\b|\s*$)|pnpm\s+(i|install|add|dlx|update)\b|'
                     r'bun\s+(i|install|add|x)\b|bunx\s|pip[0-9.]*\s+(install|download)\b|python[0-9.]*\s+-m\s+(pip|ensurepip)\b|pipx\s|uv\s+(pip|add|sync|tool)\b|'
                     r'poetry\s+(add|install|update)\b|conda\s+(install|create|update)\b|apt(-get)?\s+(install|update|upgrade)\b|apk\s+add\b|dnf\s+install\b|yum\s+install\b|'
                     r'brew\s+(install|upgrade)\b|gem\s+install\b|cargo\s+(install|add)\b|go\s+(install|get)\b|playwright\s+install\b)', re.I)
PRIV = re.compile(r'(?<![\w./-])(sudo|doas|su)(\s|$)')
DOWNLOAD = re.compile(r'(?<![\w./-])(curl|wget|aria2c|fetch)(\s|$)')
PIPE_SHELL = re.compile(r'\|\s*(sudo\s+)?(sh|bash|zsh|dash|ksh|fish|python[0-9.]*|node)\b(\s+-)?(\s|$)|(?<![\w./-])(sh|bash|zsh)\s+<\(|\beval\s+["\']?\$\(|(?<![\w./-])source\s+<\(')
SECRET_PATH = re.compile(r'(^|[\s\'"=/])(\.env(\.[\w-]+)?|\.npmrc|\.netrc|\.pypirc|\.git-credentials|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|[\w.-]+\.(pem|key|p12|pfx|jks|keystore|ppk|kdbx)|'
                         r'credentials?(\.json|\.ya?ml)?|secrets?(\.json|\.ya?ml|\.txt)?)(?=$|[\s\'";|&)])|(~|\$HOME|/root|/home/[\w.-]+)/\.(ssh|aws|gnupg|kube|docker|azure)\b|'
                         r'/\.config/(gh|gcloud|git/credentials)\b|/proc/[\w]+/environ', re.I)
SECRET_ENV = re.compile(r'\$\{?\w*(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|CREDENTIAL)\w*\}?|(?<![\w./-])(printenv|env|set)\s*($|[|>;&])|\bgh\s+auth\s+(token|status\s+-t|login)\b|'
                        r'\bgit\s+(config\s+.*credential|credential\b)|\b(export|declare)\s+-p\b', re.I)
URL_CREDS = re.compile(r'[a-z][a-z0-9+.-]*://[^/\s:@\'"]+:[^/\s:@\'"]+@', re.I)


def block(reason):
    print('BLOCKED by .claude/hooks/guard.py: ' + reason + ' See CLAUDE.md > Security rules.', file=sys.stderr)
    sys.exit(2)


def check_bash(cmd):
    if INSTALL.search(cmd):
        block('installing packages is not allowed in this project. Work with what is already installed and tell the user what was missing.')
    if PRIV.search(cmd):
        block('sudo / su is not allowed.')
    if PIPE_SHELL.search(cmd):
        block('piping or substituting downloaded or generated text into a shell or interpreter is not allowed.')
    if DOWNLOAD.search(cmd):
        block('curl / wget are not allowed. Use the WebFetch tool for public pages, with tracking parameters removed.')
    if URL_CREDS.search(cmd):
        block('a URL with credentials in it. Never put tokens or passwords in commands.')
    if SECRET_PATH.search(cmd):
        block('this command touches a credentials or key file.')
    if SECRET_ENV.search(cmd):
        block('this command reads or prints secrets from the environment or a credential store.')


def main():
    try:
        data = json.load(sys.stdin)
    except ValueError:
        block('hook input was not valid JSON, refusing by default.')
    tool, inp = data.get('tool_name', ''), data.get('tool_input') or {}
    if tool in ('Bash', 'PowerShell', 'Monitor'):
        check_bash(str(inp.get('command', '')))
    elif tool in ('Read', 'Edit', 'Write', 'NotebookEdit'):
        path = str(inp.get('file_path') or inp.get('notebook_path') or '')
        if SECRET_PATH.search(' ' + path):
            block('reading or writing a credentials or key file (%s).' % os.path.basename(path))
        if tool != 'Read':
            from check_secrets import PATTERNS
            text = str(inp.get('content') or inp.get('new_string') or inp.get('new_source') or '')
            for label, rx in PATTERNS:
                if rx.search(text):
                    block('the text being written contains what looks like a secret (%s).' % label)
    elif tool == 'WebFetch':
        from clean_url import clean_url
        url = str(inp.get('url', ''))
        if URL_CREDS.search(url):
            block('a URL with credentials in it.')
        try:
            cleaned = clean_url(url)
        except ValueError:
            cleaned = url
        if cleaned != url.strip():
            block('the URL carries tracking parameters. Fetch this instead: ' + cleaned + ' .')
    sys.exit(0)


if __name__ == '__main__':
    main()
