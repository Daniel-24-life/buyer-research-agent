import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).parents[1]


class TagCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class UiContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / 'dist' / 'index.html').read_text(encoding='utf-8')
        cls.css = (ROOT / 'dist' / 'styles.css').read_text(encoding='utf-8')
        cls.js = (ROOT / 'dist' / 'app.js').read_text(encoding='utf-8')
        cls.parser = TagCollector()
        cls.parser.feed(cls.html)

    def test_semantic_navigation_and_main_landmarks_exist(self):
        tags = [tag for tag, _ in self.parser.tags]
        self.assertIn('nav', tags)
        self.assertIn('main', tags)
        current = [attrs for tag, attrs in self.parser.tags if tag == 'a' and attrs.get('aria-current') == 'page']
        self.assertEqual(len(current), 1)

    def test_write_controls_are_disabled_before_connection(self):
        write_ids = {'enqueue', 'pause', 'resume', 'next'}
        controls = {attrs.get('id'): attrs for tag, attrs in self.parser.tags if tag == 'button'}
        self.assertTrue(write_ids.issubset(controls))
        self.assertTrue(all('disabled' in controls[control_id] for control_id in write_ids))

    def test_connection_states_retry_and_write_guard_are_present(self):
        for state in ('loading', 'ready', 'error', 'stale'):
            self.assertIn(state, self.js)
        self.assertIn("connectionState !== 'ready'", self.js)
        self.assertIn("$('retry').addEventListener", self.js)
        self.assertIn('AbortController', self.js)

    def test_idempotency_key_changes_only_after_success_or_input_change(self):
        self.assertIn("if (await action('/api/enqueue'", self.js)
        self.assertIn("$('product').addEventListener('input'", self.js)
        self.assertEqual(self.js.count('requestId = crypto.randomUUID()'), 3)

    def test_requested_palette_type_and_narrow_breakpoint(self):
        for token in ('#f3f6f8', '#102536', '#12685f', 'font-size:16px', '@media(max-width:360px)'):
            self.assertIn(token, self.css)
        self.assertNotIn('letter-spacing', self.css)

    def test_selected_detail_contains_decision_fields(self):
        for label in ('需求原文', '发布日期', '截止日期', '证据缺口', '下一动作'):
            self.assertIn(label, self.js)


if __name__ == '__main__':
    unittest.main()
