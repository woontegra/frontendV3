/**
 * Panel FE redirect allowlist tests (plain JS mirror of parseRenewalRedirect rules).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

function parseRenewalRedirect(payload) {
  const root = payload && typeof payload === 'object' ? payload : {};
  const data = root.data && typeof root.data === 'object' ? root.data : root;
  const redirectUrl = String(
    data.redirectUrl || data.checkoutUrl || data.url || '',
  ).trim();
  if (!redirectUrl) throw new Error('Yenileme yönlendirme adresi alınamadı.');
  const url = new URL(redirectUrl);
  const allowedHosts = new Set([
    'woontegra.com',
    'www.woontegra.com',
    'bilirkisihesap.com',
    'www.bilirkisihesap.com',
  ]);
  const pathOk =
    url.pathname === '/yazilimlar/bilirkisi-hesap/satin-al' ||
    url.pathname === '/abonelik-yenile';
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || !pathOk) {
    throw new Error('Geçersiz yenileme yönlendirme adresi.');
  }
  if (!url.searchParams.get('renew')) {
    throw new Error('Yenileme anahtarı alınamadı.');
  }
  return url.toString();
}

test('accepts Woontegra satin-al renew URL', () => {
  const url = parseRenewalRedirect({
    redirectUrl:
      'https://www.woontegra.com/yazilimlar/bilirkisi-hesap/satin-al?renew=abc123',
  });
  assert.match(url, /woontegra\.com/);
  assert.match(url, /renew=abc123/);
});

test('accepts legacy BH abonelik-yenile URL', () => {
  const url = parseRenewalRedirect({
    redirectUrl: 'https://www.bilirkisihesap.com/abonelik-yenile?renew=xyz',
  });
  assert.match(url, /abonelik-yenile/);
});

test('rejects foreign host', () => {
  assert.throws(() =>
    parseRenewalRedirect({
      redirectUrl: 'https://evil.example/yazilimlar/bilirkisi-hesap/satin-al?renew=x',
    }),
  );
});

test('rejects missing renew param', () => {
  assert.throws(() =>
    parseRenewalRedirect({
      redirectUrl: 'https://www.woontegra.com/yazilimlar/bilirkisi-hesap/satin-al',
    }),
  );
});
