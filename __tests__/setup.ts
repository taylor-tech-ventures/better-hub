import nock from 'nock';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * Global test setup for GitHub DAL unit tests.
 *
 * Enables nock HTTP interception before any tests run, cleans up
 * interceptors between tests, and restores normal networking after
 * the test suite finishes. All tests in this project should rely on
 * nock mocks — no real network requests are allowed during test runs.
 */
beforeAll(() => {
  nock.disableNetConnect();
});

afterAll(() => {
  nock.enableNetConnect();
  nock.restore();
});

afterEach(() => {
  nock.cleanAll();
});
