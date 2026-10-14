"""Offline reconstruction: demand evidence and a durable demonstration queue."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path


def classify(record: dict, asof: date) -> dict:
    gaps = []
    for field in ('identity_verified', 'product_match', 'contact_verified', 'source_matched'):
        if record.get(field) is not True:
            gaps.append(field)
    try:
        published = date.fromisoformat(record.get('published_on', ''))
        if not 0 <= (asof - published).days <= 90:
            gaps.append('publication_date')
        if record.get('closes_on') and date.fromisoformat(record['closes_on']) < asof:
            gaps.append('expired_demand')
    except (ValueError, TypeError):
        gaps.append('publication_date')
    kind = record.get('kind')
    if not record.get('quote') or kind not in ('rfq', 'project'):
        gaps.append('demand_evidence')
    category = 'pending' if gaps else ('explicit' if kind == 'rfq' else 'opportunity')
    return {**record, 'category': category, 'gaps': gaps,
            'procurement_authority': 'unknown', 'outreach_sent': False}


class Queue:
    def __init__(self, path: Path):
        self.path = path
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY, request_id TEXT UNIQUE,
                    product TEXT, status TEXT DEFAULT 'queued');
                CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, paused INTEGER);
                INSERT OR IGNORE INTO settings VALUES (1, 0);
                UPDATE tasks SET status='interrupted' WHERE status='running';
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path)
        try:
            with db:
                yield db
        finally:
            db.close()

    def enqueue(self, request_id: str, product: str) -> int:
        with self.connect() as db:
            existing = db.execute('SELECT id, product FROM tasks WHERE request_id=?', (request_id,)).fetchone()
            if existing:
                if existing[1] != product:
                    raise ValueError('request_id already belongs to another product')
                return existing[0]
            return db.execute('INSERT INTO tasks(request_id,product) VALUES (?,?)', (request_id, product)).lastrowid

    def state(self):
        with self.connect() as db:
            return {'paused': bool(db.execute('SELECT paused FROM settings').fetchone()[0]),
                    'tasks': [dict(zip(('id', 'product', 'status'), row)) for row in
                              db.execute('SELECT id,product,status FROM tasks ORDER BY id')]}

    def pause(self, paused: bool):
        with self.connect() as db:
            db.execute('UPDATE settings SET paused=?', (int(paused),))

    def run_next(self):
        # One offline step; no worker, CLI subprocess, model, network, or real buyers.
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT paused FROM settings').fetchone()[0]:
                return None
            row = db.execute("SELECT id FROM tasks WHERE status='queued' ORDER BY id LIMIT 1").fetchone()
            if row is None:
                return None
            db.execute("UPDATE tasks SET status='completed' WHERE id=?", row)
            return row[0]

    def cancel(self, task_id: int):
        with self.connect() as db:
            if db.execute("UPDATE tasks SET status='cancelled' WHERE id=? AND status='queued'", (task_id,)).rowcount != 1:
                raise ValueError('only queued tasks can be cancelled')


def load_demo():
    payload = json.loads(Path(__file__).with_name('sample.fake.json').read_text(encoding='utf-8'))
    payload['records'] = [classify(item, date.fromisoformat(payload['asof'])) for item in payload['records']]
    return payload
