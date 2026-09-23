import { expect, test } from '@playwright/test';
import { accessToken, accessHeaders } from './support/access-auth';

test('valid local Access JWT reaches protected Worker route', async ({ request }) => {
  const response = await request.get('/', { headers: await accessHeaders() });
  expect(response.status()).toBe(200);
});

test('missing local Access JWT is rejected before route handling', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(401);
});

test('wrong audience local Access JWT is rejected', async ({ request }) => {
  const response = await request.get('/', {
    headers: { 'Cf-Access-Jwt-Assertion': await accessToken({ aud: 'wrong-audience' }) }
  });
  expect(response.status()).toBe(401);
});

test('wrong issuer local Access JWT is rejected', async ({ request }) => {
  const response = await request.get('/', {
    headers: { 'Cf-Access-Jwt-Assertion': await accessToken({ iss: 'https://evil.example' }) }
  });
  expect(response.status()).toBe(401);
});

test('expired local Access JWT is rejected', async ({ request }) => {
  const response = await request.get('/', {
    headers: { 'Cf-Access-Jwt-Assertion': await accessToken({ exp: 1 }) }
  });
  expect(response.status()).toBe(401);
});
