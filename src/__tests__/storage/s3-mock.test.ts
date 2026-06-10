/**
 * S3 Storage Backend Tests
 *
 * Detailed tests for S3StorageBackend using AWS SDK mocks.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { S3StorageBackend, StorageBackendError } from '../../core/storage/backend.js';

// Define the SDK bundle interface to match the implementation
interface S3SDKBundle {
  client: {
    send: jest.Mock<any>;
  };
  GetObjectCommand: any;
  PutObjectCommand: any;
  DeleteObjectCommand: any;
  HeadObjectCommand: any;
  HeadBucketCommand: any;
  ListObjectsV2Command: any;
}

describe('S3StorageBackend integration', () => {
  let backend: S3StorageBackend;
  let mockSDK: S3SDKBundle;

  beforeEach(() => {
    // Create a mock SDK bundle
    mockSDK = {
      client: {
        send: jest.fn<any>()
      },
      GetObjectCommand: jest.fn((input: any) => ({ name: 'GetObjectCommand', input })),
      PutObjectCommand: jest.fn((input: any) => ({ name: 'PutObjectCommand', input })),
      DeleteObjectCommand: jest.fn((input: any) => ({ name: 'DeleteObjectCommand', input })),
      HeadObjectCommand: jest.fn((input: any) => ({ name: 'HeadObjectCommand', input })),
      HeadBucketCommand: jest.fn((input: any) => ({ name: 'HeadBucketCommand', input })),
      ListObjectsV2Command: jest.fn((input: any) => ({ name: 'ListObjectsV2Command', input }))
    };

    backend = new S3StorageBackend({
      bucket: 'test-bucket',
      keyPrefix: 'prefix'
    });

    // Inject the mock SDK into the backend
    (backend as any).sdk = mockSDK;
  });

  describe('read', () => {
    it('reads and transforms S3 object body to string', async () => {
      const mockTransformToString = jest.fn<() => Promise<string>>().mockResolvedValue('{"foo":"bar"}');
      mockSDK.client.send.mockResolvedValue({
        Body: { transformToString: mockTransformToString }
      });

      const result = await backend.read('test.json');

      expect(result).toBe('{"foo":"bar"}');
      expect(mockSDK.GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'prefix/test.json'
      });
      expect(mockTransformToString).toHaveBeenCalled();
    });

    it('throws StorageBackendError on S3 failure', async () => {
      mockSDK.client.send.mockRejectedValue(new Error('S3 Access Denied'));

      await expect(backend.read('test.json')).rejects.toThrow(StorageBackendError);
    });
  });

  describe('write', () => {
    it('writes data to S3 with correct key and content type', async () => {
      mockSDK.client.send.mockResolvedValue({});

      await backend.write('test.json', 'data');

      expect(mockSDK.PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'prefix/test.json',
        Body: 'data',
        ContentType: 'text/plain; charset=utf-8'
      });
    });
  });

  describe('delete', () => {
    it('deletes object from S3', async () => {
      mockSDK.client.send.mockResolvedValue({});

      await backend.delete('test.json');

      expect(mockSDK.DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'prefix/test.json'
      });
    });
  });

  describe('exists', () => {
    it('returns true if HeadObject succeeds', async () => {
      mockSDK.client.send.mockResolvedValue({});

      const exists = await backend.exists('test.json');

      expect(exists).toBe(true);
    });

    it('returns false if HeadObject returns 404', async () => {
      const error = new Error('Not Found');
      (error as any).name = 'NotFound';
      mockSDK.client.send.mockRejectedValue(error);

      const exists = await backend.exists('test.json');

      expect(exists).toBe(false);
    });

    it('throws StorageBackendError on non-404 HeadObject failure', async () => {
      mockSDK.client.send.mockRejectedValue(new Error('S3 Error'));

      await expect(backend.exists('test.json')).rejects.toThrow(StorageBackendError);
    });
  });

  describe('list', () => {
    it('lists and strips prefixes from S3 keys', async () => {
      mockSDK.client.send.mockResolvedValue({
        Contents: [
          { Key: 'prefix/dir/a.json' },
          { Key: 'prefix/dir/b.json' }
        ],
        IsTruncated: false
      });

      const keys = await backend.list('dir');

      expect(keys).toEqual(['dir/a.json', 'dir/b.json']);
      expect(mockSDK.ListObjectsV2Command).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Prefix: 'prefix/dir'
      });
    });

    it('handles pagination via ContinuationToken', async () => {
      mockSDK.client.send
        .mockResolvedValueOnce({
          Contents: [{ Key: 'prefix/a.json' }],
          IsTruncated: true,
          NextContinuationToken: 'token1'
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'prefix/b.json' }],
          IsTruncated: false
        });

      const keys = await backend.list('');

      expect(keys).toEqual(['a.json', 'b.json']);
      expect(mockSDK.client.send).toHaveBeenCalledTimes(2);
      expect(mockSDK.ListObjectsV2Command).toHaveBeenNthCalledWith(2, expect.objectContaining({
        ContinuationToken: 'token1'
      }));
    });
  });

  describe('healthCheck', () => {
    it('returns healthy if HeadBucket succeeds', async () => {
      mockSDK.client.send.mockResolvedValue({});

      const result = await backend.healthCheck();

      expect(result.healthy).toBe(true);
      expect(mockSDK.HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'test-bucket' });
    });

    it('returns unhealthy if HeadBucket fails', async () => {
      mockSDK.client.send.mockRejectedValue(new Error('Bucket missing'));

      const result = await backend.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Bucket missing');
    });
  });
});
