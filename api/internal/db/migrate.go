package db

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Migrate reads and executes the SQL migration file at the given path.
func Migrate(ctx context.Context, pool *pgxpool.Pool, migrationPath string) error {
	sql, err := os.ReadFile(migrationPath)
	if err != nil {
		return fmt.Errorf("read migration file %s: %w", migrationPath, err)
	}

	if _, err := pool.Exec(ctx, string(sql)); err != nil {
		return fmt.Errorf("execute migration %s: %w", migrationPath, err)
	}

	return nil
}
