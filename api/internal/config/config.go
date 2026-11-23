package config

import (
	"os"
	"time"
)

type Config struct {
	DatabaseURL    string
	MinIOEndpoint  string
	MinIOAccessKey string
	MinIOSecretKey string
	MinIOBucket    string
	MinIOUseSSL    bool
	ServerAddr     string
	ReadTimeout    time.Duration
	WriteTimeout   time.Duration
}

func Load() *Config {
	return &Config{
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/dumbpipe?sslmode=disable"),
		MinIOEndpoint:  getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey: getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinIOSecretKey: getEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinIOBucket:    getEnv("MINIO_BUCKET", "dumbpipe-chunks"),
		MinIOUseSSL:    getEnvBool("MINIO_USE_SSL", false),
		ServerAddr:     getEnv("SERVER_ADDR", ":8080"),
		ReadTimeout:    getEnvDuration("READ_TIMEOUT", 10*time.Second),
		WriteTimeout:   getEnvDuration("WRITE_TIMEOUT", 10*time.Second),
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v == "1" || v == "true" || v == "TRUE"
}

func getEnvDuration(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}
