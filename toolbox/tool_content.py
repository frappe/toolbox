# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""The content of one tool page, as the server sends it.

Toolbox is a client-rendered application, so a crawler that runs no JavaScript reads an empty body.
This module reads what the build wrote and hands it to `toolbox/www/toolbox.py`, which renders it
inside the element the application mounts on. Vue empties that element when it mounts, so a visitor
sees the block until the application takes over, and never sees it twice.

The files under `content/pages` are generated from the Markdown in `content` by the Vite build, and
they are committed. One renderer produces both the HTML here and the HTML the client shows after an
in-app navigation, so the two cannot drift apart.

This module imports nothing from Frappe, for the same reason `toolbox/seo.py` imports nothing: the
content is the product, it is worth testing on its own, and a plain function that takes a route is
easier to test than one that reads a request.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

PAGES_DIRECTORY = (Path(__file__).parent / "content" / "pages").resolve()


@dataclass(frozen=True)
class Faq:
	"""One question and its answer, as plain text. `FAQPage` JSON-LD carries no markup."""

	question: str
	answer: str


@dataclass(frozen=True)
class PageContent:
	"""What one route sends below its heading.

	The heading itself comes from `toolbox/seo.py` and is rendered by the template, because every
	route has a name there and only a tool has content here.
	"""

	route: str
	content: str
	faqs: tuple[Faq, ...]
	steps: tuple[str, ...]


def page_content(route: str) -> PageContent | None:
	"""Return the content of a route, or None for a route that has none.

	The root and the settings page have no content file, and neither does a tool whose page is not
	written yet. Both cases render nothing rather than an empty block.
	"""
	path = (PAGES_DIRECTORY / f"{route.strip('/')}.json").resolve()
	# A requested path is untrusted, so the file has to sit directly in the content directory. A
	# route such as `/../../secrets` names a real file, and this is what stops it being read.
	if path.parent != PAGES_DIRECTORY or not path.is_file():
		return None
	return _read_page(path, path.stat().st_mtime_ns)


# The page is rendered on every request, so the file is read once and kept. The modification time
# is part of the key: a rebuilt content file has to reach the next request without a restart.
@lru_cache(maxsize=64)
def _read_page(path: Path, modified_at: int) -> PageContent:
	page = json.loads(path.read_text(encoding="utf-8"))
	return PageContent(
		route=page["route"],
		content=page["content"],
		faqs=tuple(Faq(question=faq["question"], answer=faq["answer"]) for faq in page["faqs"]),
		steps=tuple(page["steps"]),
	)
