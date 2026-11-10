#!/usr/bin/env python3
"""Strip tracking parameters from a URL. Every fetch script must pass its URLs through this first.

    python3 tools/clean_url.py "https://example.com/a?utm_source=x&id=7"     -> https://example.com/a?id=7

    from clean_url import clean_url, has_tracking

The list of parameters lives in tools/tracking_params.json (shared with tools/clean_url.js).
"s" and "t" are only removed on hosts where they are share trackers (x.com, twitter.com), and
"feature"/"pp" only on YouTube, so ordinary query parameters with those names survive elsewhere.
"""
import json, os, sys
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

_RULES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tracking_params.json')))
_PREFIXES = tuple(_RULES['prefixes'])
_NAMES = set(_RULES['names'])
_HOST_ONLY = {'s': ('x.com', 'twitter.com'), 't': ('x.com', 'twitter.com'),
              'feature': ('youtube.com', 'youtu.be'), 'pp': ('youtube.com', 'youtu.be')}


def _is_tracking(name, host):
    n = name.lower()
    if n in _HOST_ONLY:
        return any(host == h or host.endswith('.' + h) for h in _HOST_ONLY[n])
    return n in _NAMES or n.startswith(_PREFIXES)


def clean_url(url):
    p = urlsplit(url.strip())
    host = (p.hostname or '').lower()
    kept = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if not _is_tracking(k, host)]
    frag = p.fragment
    if '=' in frag and all(_is_tracking(k, host) for k, _ in parse_qsl(frag, keep_blank_values=True)):
        frag = ''                                   # a fragment made only of tracking pairs
    return urlunsplit((p.scheme, p.netloc, p.path, urlencode(kept, doseq=True), frag))


def has_tracking(url):
    return clean_url(url) != url.strip()


if __name__ == '__main__':
    for u in sys.argv[1:] or [l for l in sys.stdin.read().split() if l]:
        print(clean_url(u))
