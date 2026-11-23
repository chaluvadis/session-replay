package storage

import (
	"bytes"
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type Storage struct {
	client *minio.Client
	bucket string
}

func New(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*Storage, error) {
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

	return &Storage{client: client, bucket: bucket}, nil
}

func (s *Storage) PutObject(ctx context.Context, objectKey string, data []byte, contentType string) error {
	_, err := s.client.PutObject(ctx, s.bucket, objectKey, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return fmt.Errorf("put object %s: %w", objectKey, err)
	}
	return nil
}

func (s *Storage) PresignedPutObject(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	url, err := s.client.PresignedPutObject(ctx, s.bucket, objectKey, expiry)
	if err != nil {
		return "", fmt.Errorf("presigned put object %s: %w", objectKey, err)
	}
	return url.String(), nil
}

func (s *Storage) PresignedGetObject(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	reqParams := url.Values{}
	url, err := s.client.PresignedGetObject(ctx, s.bucket, objectKey, expiry, reqParams)
	if err != nil {
		return "", fmt.Errorf("presigned get object %s: %w", objectKey, err)
	}
	return url.String(), nil
}

func (s *Storage) RemoveObject(ctx context.Context, objectKey string) error {
	if err := s.client.RemoveObject(ctx, s.bucket, objectKey, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("remove object %s: %w", objectKey, err)
	}
	return nil
}
