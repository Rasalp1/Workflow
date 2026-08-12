import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeBranchName, validateLocalPath, validateOrigin } from '../security.ts';

describe('Security Utilities', () => {
  describe('sanitizeBranchName', () => {
    it('should accept valid git branch names', () => {
      assert.strictEqual(sanitizeBranchName('main'), 'main');
      assert.strictEqual(sanitizeBranchName('feature/add-login'), 'feature/add-login');
      assert.strictEqual(sanitizeBranchName('fix_v1.0.2'), 'fix_v1.0.2');
    });

    it('should throw on command injection characters', () => {
      assert.throws(() => sanitizeBranchName('main; rm -rf /'), /unsafe shell characters/i);
      assert.throws(() => sanitizeBranchName('branch`whoami`'), /unsafe shell characters/i);
      assert.throws(() => sanitizeBranchName('branch$(calc)'), /unsafe shell characters/i);
      assert.throws(() => sanitizeBranchName('branch & echo bad'), /unsafe shell characters/i);
    });

    it('should throw on option flags or traversal', () => {
      assert.throws(() => sanitizeBranchName('--upload-pack'), /Unsafe branch name/i);
      assert.throws(() => sanitizeBranchName('../dir'), /Unsafe branch name/i);
    });
  });

  describe('validateLocalPath', () => {
    it('should validate existing workspace path', () => {
      assert.doesNotThrow(() => validateLocalPath(process.cwd()));
    });

    it('should throw on invalid or non-existent path', () => {
      assert.throws(() => validateLocalPath('/non/existent/path/99999'), /does not exist on disk/i);
      assert.throws(() => validateLocalPath('../../etc/passwd'), /Traversal or null bytes/i);
    });
  });

  describe('validateOrigin', () => {
    it('should pass for local origin or missing origin', () => {
      const mockReq = new Request('http://localhost:3000/api/config', {
        headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
      });
      assert.doesNotThrow(() => validateOrigin(mockReq));
    });

    it('should throw on external origin', () => {
      const mockReq = new Request('http://localhost:3000/api/config', {
        headers: { origin: 'https://evil-site.com', host: 'localhost:3000' },
      });
      assert.throws(() => validateOrigin(mockReq), /Forbidden cross-origin request/i);
    });
  });
});
