package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// MinIO wraps the MinIO client and bucket name.
type MinIO struct {
	client *minio.Client
	bucket string
}

// New creates a MinIO client and ensures the bucket exists.
func New(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*MinIO, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("create minio client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	exists, err := client.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("check bucket exists: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("make bucket: %w", err)
		}
	}

	return &MinIO{client: client, bucket: bucket}, nil
}

// PresignedPutURL generates a presigned PUT URL for uploading an object.
func (s *MinIO) PresignedPutURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	url, err := s.client.PresignedPutObject(ctx, s.bucket, objectKey, expiry)
	if err != nil {
		return "", fmt.Errorf("presigned put object %s: %w", objectKey, err)
	}
	return url.String(), nil
}

// PresignedGetURL generates a presigned GET URL for downloading an object.
func (s *MinIO) PresignedGetURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	url, err := s.client.PresignedGetObject(ctx, s.bucket, objectKey, expiry, nil)
	if err != nil {
		return "", fmt.Errorf("presigned get object %s: %w", objectKey, err)
	}
	return url.String(), nil
}
