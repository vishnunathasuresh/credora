import assert from 'node:assert/strict';
import test from 'node:test';
import { demoCatalog } from './index.js';

test('demo catalog contains the requested synthetic organizations and programs', () => {
  const names = demoCatalog.organizations.map((organization) => organization.shortName);
  assert.deepEqual(names, [
    'IIT Bombay',
    'NIT Trichy',
    'IIIT Kottayam',
    'NIT Calicut',
    'IIT Palakkad',
  ]);
  for (const organization of demoCatalog.organizations) {
    assert.equal(organization.status, 'synthetic-demo');
    assert.ok(organization.courses.length >= 2);
    assert.ok(organization.certifications.length >= 2);
    assert.ok(
      organization.learners.every((learner) =>
        learner.credentials.every((credential) => credential.status === 'synthetic-demo'),
      ),
    );
  }
});
