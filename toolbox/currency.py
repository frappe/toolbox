# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
from datetime import UTC, datetime

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from redis.exceptions import LockError

from toolbox.currency_provider import CurrencyProviderError, EcbReferenceRateProvider
from toolbox.provider_errors import provider_unavailable

CACHE_KEY = "currency:ecb:reference-rates:v1"
LOCK_KEY = "currency:ecb:refresh-lock:v1"
FRESH_SECONDS = 6 * 60 * 60
STALE_SECONDS = 30 * 24 * 60 * 60


@frappe.whitelist(allow_guest=True, methods=["GET"])
@rate_limit(limit=60, seconds=60)
def get_reference_rates() -> dict[str, object]:
	"""Return public ECB rates. User conversion inputs never reach this endpoint."""
	return CurrencyRateService().get()


class CurrencyRateService:
	def __init__(
		self,
		provider: EcbReferenceRateProvider | None = None,
		cache: object | None = None,
		clock: Callable[[], datetime] | None = None,
	) -> None:
		self.provider = provider or EcbReferenceRateProvider()
		self.cache = cache or frappe.cache
		self.clock = clock or (lambda: datetime.now(UTC))

	def get(self) -> dict[str, object]:
		cached = self._get_cached()
		if cached and self._is_fresh(cached):
			return self._public_response(cached, "cached")

		lock_name = self.cache.make_key(LOCK_KEY) if hasattr(self.cache, "make_key") else LOCK_KEY
		try:
			with self.cache.lock(lock_name, timeout=15, blocking_timeout=5):
				cached = self._get_cached()
				if cached and self._is_fresh(cached):
					return self._public_response(cached, "cached")
				return self._refresh(cached)
		except LockError as error:
			cached = self._get_cached()
			if cached:
				return self._public_response(cached, "stale")
			raise provider_unavailable(
				_("Currency reference rates are temporarily unavailable. Please try again later."),
				provider="European Central Bank (rate lock)",
				cause=error,
			) from None

	def _refresh(self, cached: dict[str, object] | None) -> dict[str, object]:
		try:
			provider_result = self.provider.fetch(cached.get("validators") if cached else None)
		except CurrencyProviderError as error:
			if cached:
				return self._public_response(cached, "stale")
			raise provider_unavailable(
				_("Currency reference rates are temporarily unavailable. Please try again later."),
				provider="European Central Bank",
				cause=error,
			) from None

		checked_at = self.clock().isoformat()
		if provider_result["notModified"]:
			if not cached:
				raise provider_unavailable(
					_("Currency reference rates are temporarily unavailable."),
					provider="European Central Bank",
					note="The ECB answered 304 Not Modified, and there is no cached table to reuse. "
					"A conditional request was sent with validators that outlived their table.",
				)
			cached["providerCheckedAt"] = checked_at
			self._store(cached)
			return self._public_response(cached, "cached")

		stored = {
			**provider_result["data"],
			"providerCheckedAt": checked_at,
			"validators": provider_result["validators"],
		}
		self._store(stored)
		return self._public_response(stored, "live")

	def _get_cached(self) -> dict[str, object] | None:
		return self.cache.get_value(CACHE_KEY, expires=True, use_local_cache=False)

	def _store(self, value: dict[str, object]) -> None:
		self.cache.set_value(CACHE_KEY, value, expires_in_sec=STALE_SECONDS)

	def _is_fresh(self, value: dict[str, object]) -> bool:
		try:
			checked_at = datetime.fromisoformat(str(value["providerCheckedAt"]))
		except KeyError, TypeError, ValueError:
			return False
		if checked_at.tzinfo is None:
			return False
		return (self.clock() - checked_at).total_seconds() < FRESH_SECONDS

	@staticmethod
	def _public_response(value: dict[str, object], cache_status: str) -> dict[str, object]:
		response = deepcopy(value)
		response.pop("validators", None)
		response["cacheStatus"] = cache_status
		response["referenceRateNotice"] = (
			"ECB reference rates are for information only and are not transaction rates."
		)
		return response
