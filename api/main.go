package main

import (
	"context"
	"log"
	"net/http"

	"github.com/go-chi/cors"

	"dumb-pipe/api/internal/config"
	"dumb-pipe/api/internal/db"
	"dumb-pipe/api/internal/handlers"
	"dumb-pipe/api/internal/storage"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()

	store, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer store.Close()

	st, err := storage.New(cfg.MinIOEndpoint, cfg.MinIOAccessKey, cfg.MinIOSecretKey, cfg.MinIOBucket, cfg.MinIOUseSSL)
	if err != nil {
		log.Fatalf("storage: %v", err)
	}

	h := handlers.New(store.Pool(), st)
	r := h.Routes()

	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}).Handler(r)

	server := &http.Server{
		Addr:         cfg.ServerAddr,
		Handler:      handler,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}

	log.Printf("server listening on %s", cfg.ServerAddr)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("server: %v", err)
	}
}
