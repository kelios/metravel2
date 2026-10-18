"""Source loaders: one module per external or own source, read-only, cached once
in <AI_HOME>/data/sources/<name>/ next to a LICENSE file and fetched_at.json,
so repeated dataset builds never touch the network.

The site corpus itself is exported by ../export_corpus.py into data/raw (its
manifest.json plays the role of fetched_at.json).
"""
