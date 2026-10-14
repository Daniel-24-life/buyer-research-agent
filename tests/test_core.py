import tempfile
import unittest
from datetime import date
from pathlib import Path

from core import Queue, classify, load_demo


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.record = load_demo()['records'][0]

    def test_four_categories_and_no_outreach(self):
        records = load_demo()['records']
        self.assertEqual([r['category'] for r in records], ['explicit', 'opportunity', 'pending', 'pending'])
        self.assertTrue(all(not r['outreach_sent'] for r in records))

    def test_missing_evidence_never_promoted(self):
        for field in ('identity_verified', 'product_match', 'contact_verified', 'source_matched'):
            with self.subTest(field=field):
                self.assertEqual(classify({**self.record, field: None}, date(2026, 10, 14))['category'], 'pending')

    def test_future_date_not_accepted(self):
        self.assertEqual(classify({**self.record, 'published_on': '2026-10-15'}, date(2026, 10, 14))['category'], 'pending')

    def test_catalog_not_purchase_evidence(self):
        self.assertEqual(classify({**self.record, 'kind': 'catalog'}, date(2026, 10, 14))['category'], 'pending')

    def test_expired_deadline(self):
        self.assertIn('expired_demand', classify({**self.record, 'closes_on': '2026-10-13'}, date(2026, 10, 14))['gaps'])


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'queue.sqlite'
        self.queue = Queue(self.path)

    def test_idempotency_and_conflict(self):
        first = self.queue.enqueue('same', 'product')
        self.assertEqual(first, self.queue.enqueue('same', 'product'))
        with self.assertRaises(ValueError):
            self.queue.enqueue('same', 'changed')

    def test_pause_and_fifo(self):
        a = self.queue.enqueue('a', 'first')
        b = self.queue.enqueue('b', 'second')
        self.queue.pause(True)
        self.assertIsNone(self.queue.run_next())
        self.queue.pause(False)
        self.assertEqual(self.queue.run_next(), a)
        self.assertEqual(self.queue.run_next(), b)
        self.assertIsNone(self.queue.run_next())

    def test_cancellation(self):
        a = self.queue.enqueue('a', 'first')
        self.queue.cancel(a)
        self.assertIsNone(self.queue.run_next())
        with self.assertRaises(ValueError):
            self.queue.cancel(a)

    def test_restart_preserves_pause_and_marks_interruption(self):
        a = self.queue.enqueue('a', 'first')
        with self.queue.connect() as db:
            db.execute("UPDATE tasks SET status='running' WHERE id=?", (a,))
        self.queue.pause(True)
        fresh = Queue(self.path).state()
        self.assertTrue(fresh['paused'])
        self.assertEqual(fresh['tasks'][0]['status'], 'interrupted')


if __name__ == '__main__':
    unittest.main()
