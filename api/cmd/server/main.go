package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"dumb-pipe/api/internal/db"
	"dumb-pipe/api/internal/handlers"
	"dumb-pipe/api/internal/storage"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Load configuration from environment variables.
	databaseURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/session-replay?sslmode=disable")
	minIOEndpoint := getEnv("MINIO_ENDPOINT", "localhost:9000")
	minIOAccessKey := getEnv("MINIO_ACCESS_KEY", "minioadmin")
	minIOSecretKey := getEnv("MINIO_SECRET_KEY", "minioadmin")
	minIOBucket := getEnv("MINIO_BUCKET", "session-replays")
	serverAddr := getEnv("SERVER_ADDR", ":8080")

	// Connect to PostgreSQL.
	postgres, err := db.New(databaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer postgres.Close()

	// Run migrations.
	if err := db.Migrate(ctx, postgres.Pool(), "api/migrations/001_initial.sql"); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	// Connect to MinIO.
	minioClient, err := storage.New(minIOEndpoint, minIOAccessKey, minIOSecretKey, minIOBucket, false)
	if err != nil {
		log.Fatalf("failed to connect to minio: %v", err)
	}
	_ = minioClient

	// Initialize handlers.
	healthHandler := handlers.NewHealthHandler()
	sessionsHandler := handlers.NewSessionsHandler(postgres.Pool())
	chunksHandler := handlers.NewChunksHandler(postgres.Pool(), minioClient)

	// Setup chi router.
	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", healthHandler.ServeHTTP)

		r.Route("/sessions", func(r chi.Router) {
			r.Post("/", sessionsHandler.CreateSession)
			r.Get("/", sessionsHandler.ListSessions)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", sessionsHandler.GetSession)
				r.Post("/complete", sessionsHandler.CompleteSession)
			})
		})

		r.Route("/chunks", func(r chi.Router) {
			r.Post("/", chunksHandler.CreateChunk)
			r.Get("/{sessionID}", chunksHandler.GetChunk)
		})
	})

	server := &http.Server{
		Addr:         serverAddr,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Start server in a goroutine.
	go func() {
		log.Printf("server listening on %s", serverAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Wait for shutdown signal.
	<-ctx.Done()
	log.Println("shutting down server...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("server shutdown failed: %v", err)
	}

	log.Println("server stopped")
}

// getEnv returns the value of the environment variable key, or def if unset.
func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
