import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  fileStorage,
  inlineContentDisposition,
  sendStoredFile,
} from '../../../src/common/storage/file-storage';

describe('fileStorage', () => {
  const env = { ...process.env };
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  afterEach(() => {
    process.env = { ...env };
    global.fetch = originalFetch;
    (fileStorage as any).bucketReady = null;
  });

  describe('without Supabase config (local disk, as before)', () => {
    let cwd: string;
    let tmp: string;
    beforeEach(() => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-'));
      cwd = process.cwd();
      jest.spyOn(process, 'cwd').mockReturnValue(tmp);
    });
    afterEach(() => {
      (process.cwd as jest.Mock).mockRestore?.();
      fs.rmSync(tmp, { recursive: true, force: true });
      expect(process.cwd()).toBe(cwd);
    });

    it('writes to uploads/<folder>/ and reads it back', async () => {
      const stored = await fileStorage.save('documents', 'a.pdf', Buffer.from('hello'), 'application/pdf');
      expect(stored).toBe('uploads/documents/a.pdf');
      const file = await fileStorage.read(stored);
      expect(file?.localPath).toBe(path.join(tmp, 'uploads', 'documents', 'a.pdf'));
      expect(fs.readFileSync(file!.localPath!, 'utf8')).toBe('hello');

      await fileStorage.remove(stored);
      await expect(fileStorage.read(stored)).resolves.toBeNull();
    });
  });

  describe('with Supabase Storage', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://proj.supabase.co/';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
      delete process.env.SUPABASE_STORAGE_BUCKET;
      fetchMock = jest.fn();
      global.fetch = fetchMock as any;
    });

    it('creates the private bucket once and uploads to it', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'The resource already exists' })
        .mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });

      const stored = await fileStorage.save('expenses', 'hoá đơn 1.pdf', Buffer.from('pdf'), 'application/pdf');
      await fileStorage.save('expenses', 'b.png', Buffer.from('png'), 'image/png');

      expect(stored).toBe('supabase://mkt-hub-files/expenses/hoá đơn 1.pdf');
      const [bucketUrl, bucketInit] = fetchMock.mock.calls[0];
      expect(bucketUrl).toBe('https://proj.supabase.co/storage/v1/bucket');
      expect(JSON.parse(bucketInit.body)).toEqual({ id: 'mkt-hub-files', name: 'mkt-hub-files', public: false });

      const [uploadUrl, uploadInit] = fetchMock.mock.calls[1];
      expect(uploadUrl).toBe(
        'https://proj.supabase.co/storage/v1/object/mkt-hub-files/expenses/ho%C3%A1%20%C4%91%C6%A1n%201.pdf',
      );
      expect(uploadInit.method).toBe('POST');
      expect(uploadInit.headers).toEqual(
        expect.objectContaining({ Authorization: 'Bearer service-key', apikey: 'service-key', 'Content-Type': 'application/pdf' }),
      );
      // bucket creation is not repeated for the 2nd upload
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('fails the upload when Supabase rejects it', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{}' })
        .mockResolvedValueOnce({ ok: false, status: 413, text: async () => 'Payload too large' });
      await expect(fileStorage.save('documents', 'big.pdf', Buffer.from('x'))).rejects.toThrow(/413/);
    });

    it('downloads remote files and returns null when missing', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('data').buffer })
        .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Object not found' });

      const file = await fileStorage.read('supabase://mkt-hub-files/inventory-batches/x.pdf');
      expect(file?.buffer?.toString()).toBe('data');
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://proj.supabase.co/storage/v1/object/mkt-hub-files/inventory-batches/x.pdf',
      );
      await expect(fileStorage.read('supabase://mkt-hub-files/inventory-batches/missing.pdf')).resolves.toBeNull();
    });

    it('still serves files stored on disk before the switch', async () => {
      await expect(fileStorage.read('uploads/documents/does-not-exist.pdf')).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('inlineContentDisposition keeps the Vietnamese file name (RFC 5987) with an ASCII fallback', () => {
    expect(inlineContentDisposition('Hóa đơn.pdf')).toBe(
      `inline; filename="Hoa don.pdf"; filename*=UTF-8''H%C3%B3a%20%C4%91%C6%A1n.pdf`,
    );
    expect(inlineContentDisposition('a"b\\c (1).png')).toBe(
      `inline; filename="a_b_c (1).png"; filename*=UTF-8''a%22b%5Cc%20%281%29.png`,
    );
    expect(inlineContentDisposition('')).toContain('filename="attachment"');
  });

  it('sendStoredFile streams local files and writes remote content', () => {
    const res = { sendFile: jest.fn(), setHeader: jest.fn(), end: jest.fn() };
    sendStoredFile(res, { localPath: '/tmp/a.pdf' });
    expect(res.sendFile).toHaveBeenCalledWith('/tmp/a.pdf');

    sendStoredFile(res, { buffer: Buffer.from('abc') });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 3);
    expect(res.end).toHaveBeenCalledWith(Buffer.from('abc'));
  });
});
