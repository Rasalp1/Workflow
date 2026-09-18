import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  escapeAppleScriptString,
  sanitizeBranchName,
  stripNonBmpChars,
  validateConfiguredRepo,
  validateLocalPath,
  validateOrigin,
} from '../security.ts';

describe('Security Utilities', () => {
  describe('stripNonBmpChars', () => {
    it('should strip emojis and supplementary non-BMP characters', () => {
      // 🔴 (U+1F534) and 🟡 (U+1F538) are non-BMP (> U+FFFF, surrogate pairs), ✅ (U+2705) is BMP
      assert.strictEqual(stripNonBmpChars('Review 🔴 with 🟡 and ✅!'), 'Review  with  and ✅!');
      // 🚀 (U+1F680) is non-BMP, ✨ (U+2728) is BMP
      assert.strictEqual(stripNonBmpChars('Rocket 🚀 Sparkles ✨'), 'Rocket  Sparkles ✨');
      assert.strictEqual(stripNonBmpChars('No emojis here 123.'), 'No emojis here 123.');
      assert.strictEqual(stripNonBmpChars(''), '');
    });
  });
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
      assert.throws(() => validateLocalPath(process.execPath), /not a directory/i);
    });
  });

  describe('escapeAppleScriptString', () => {
    it('should escape AppleScript string delimiters and backslashes', () => {
      assert.strictEqual(escapeAppleScriptString('a"b\\c'), 'a\\"b\\\\c');
    });

    it('should represent line breaks without creating multiline string literals', () => {
      assert.strictEqual(escapeAppleScriptString('line\nbreak'), 'line\\nbreak');
    });
  });

  describe('validateOrigin', () => {
    it('should pass for local origin', () => {
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

    it('should reject an origin that merely matches the request Host header', () => {
      const mockReq = new Request('http://attacker.example/api/config', {
        headers: { origin: 'https://attacker.example', host: 'attacker.example' },
      });
      assert.throws(() => validateOrigin(mockReq), /Forbidden cross-origin request/i);
    });

    it('should throw on missing origin', () => {
      const mockReq = new Request('http://localhost:3000/api/config', {
        headers: { host: 'localhost:3000' },
      });
      assert.throws(() => validateOrigin(mockReq), /Missing Origin header/i);
    });
  });

  describe('validateConfiguredRepo', () => {
    it('allows only a configured owner/repo pair', () => {
      assert.strictEqual(validateConfiguredRepo('acme/product', ['acme/product']), 'acme/product');
      assert.throws(() => validateConfiguredRepo('acme/other', ['acme/product']), /not configured/i);
      assert.throws(() => validateConfiguredRepo('acme/product/extra', ['acme/product']), /owner\/repo/i);
    });
  });
});
