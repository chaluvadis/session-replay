package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Postgres holds the PostgreSQL connection pool.
type Postgres struct {
	pool *pgxpool.Pool
}

// New creates a new Postgres connection pool from the given database URL.
func New(databaseURL string) (*Postgres, error) {
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &Postgres{pool: pool}, nil
}

// Pool returns the underlying pgxpool.Pool.
func (p *Postgres) Pool() *pgxpool.Pool {
	return p.pool
}

// Close releases all database connections.
func (p *Postgres) Close() {
	p.pool.Close()
}
