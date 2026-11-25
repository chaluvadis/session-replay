package handlers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

// mockDB implements the DB interface using an in-memory store.
type mockDB struct {
	lastQuery   string
	lastArgs    []any
	queryRowErr error
	queryErr    error
	execErr     error

	queryRowRow *mockRow
	queryRows   *mockRows
	execResult  pgconn.CommandTag
}

func (m *mockDB) QueryRow(ctx context.Context, query string, args ...any) pgx.Row {
	m.lastQuery = query
	m.lastArgs = args
	if m.queryRowErr != nil {
		return &mockRow{err: m.queryRowErr}
	}
	if m.queryRowRow != nil {
		return m.queryRowRow
	}
	return &mockRow{err: pgx.ErrNoRows}
}

func (m *mockDB) Query(ctx context.Context, query string, args ...any) (pgx.Rows, error) {
	m.lastQuery = query
	m.lastArgs = args
	if m.queryErr != nil {
		return nil, m.queryErr
	}
	if m.queryRows != nil {
		return m.queryRows, nil
	}
	return &mockRows{}, nil
}

func (m *mockDB) Exec(ctx context.Context, query string, args ...any) (pgconn.CommandTag, error) {
	m.lastQuery = query
	m.lastArgs = args
	if m.execErr != nil {
		return pgconn.CommandTag{}, m.execErr
	}
	return m.execResult, nil
}

// mockRow implements pgx.Row.
type mockRow struct {
	err     error
	values  []any
	scanIdx int
	noRows  bool
}

func (m *mockRow) Scan(dest ...any) error {
	if m.err != nil {
		return m.err
	}
	if m.noRows {
		return pgx.ErrNoRows
	}
	if m.scanIdx >= len(m.values) {
		return errors.New("no more values to scan")
	}
	val := m.values[m.scanIdx]
	m.scanIdx++

	for i := range dest {
		switch v := dest[i].(type) {
		case *string:
			if s, ok := val.(string); ok {
				*v = s
			}
		case *time.Time:
			if t, ok := val.(time.Time); ok {
				*v = t
			}
		case **string:
			if val != nil {
				if s, ok := val.(string); ok {
					*v = &s
				}
			}
		case **time.Time:
			if val != nil {
				if t, ok := val.(time.Time); ok {
					*v = &t
				}
			}
		case *bool:
			if b, ok := val.(bool); ok {
				*v = b
			}
		case *int:
			if n, ok := val.(int); ok {
				*v = n
			}
		case *int64:
			if n, ok := val.(int64); ok {
				*v = n
			}
		case *[]byte:
			if b, ok := val.([]byte); ok {
				*v = b
			}
		case *map[string]any:
			if mv, ok := val.(map[string]any); ok {
				*v = mv
			}
		case *any:
			*v = val
		}
	}
	return nil
}

// mockRows implements pgx.Rows.
type mockRows struct {
	rows   [][]any
	idx    int
	err    error
	closed bool
}

func (m *mockRows) Close() {
	m.closed = true
}

func (m *mockRows) Err() error {
	return m.err
}

func (m *mockRows) CommandTag() pgconn.CommandTag {
	return pgconn.CommandTag{}
}

func (m *mockRows) FieldDescriptions() []pgconn.FieldDescription {
	return nil
}

func (m *mockRows) Conn() *pgx.Conn {
	return nil
}

func (m *mockRows) TypeMap() *pgtype.Map {
	return nil
}

func (m *mockRows) Values() ([]any, error) {
	return nil, nil
}

func (m *mockRows) Next() bool {
	if m.idx < len(m.rows) {
		return true
	}
	return false
}

func (m *mockRows) NextResultSet() bool {
	return false
}

func (m *mockRows) RawValues() [][]byte {
	return nil
}

func (m *mockRows) Scan(dest ...any) error {
	if m.idx >= len(m.rows) {
		return sql.ErrNoRows
	}
	row := m.rows[m.idx]
	m.idx++
	if len(row) != len(dest) {
		return errors.New("column count mismatch")
	}
	for i, val := range row {
		switch v := dest[i].(type) {
		case *string:
			if s, ok := val.(string); ok {
				*v = s
			}
		case *time.Time:
			if t, ok := val.(time.Time); ok {
				*v = t
			}
		case **string:
			if val != nil {
				if s, ok := val.(string); ok {
					*v = &s
				}
			}
		case **time.Time:
			if val != nil {
				if t, ok := val.(time.Time); ok {
					*v = &t
				}
			}
		case *bool:
			if b, ok := val.(bool); ok {
				*v = b
			}
		case *int:
			if n, ok := val.(int); ok {
				*v = n
			}
		case *int64:
			if n, ok := val.(int64); ok {
				*v = n
			}
		case *[]byte:
			if b, ok := val.([]byte); ok {
				*v = b
			}
		case *map[string]any:
			if mv, ok := val.(map[string]any); ok {
				*v = mv
			}
		case *any:
			*v = val
		}
	}
	return nil
}

func newMockRow(values ...any) *mockRow {
	return &mockRow{values: values}
}

func newMockRows(rows ...[]any) *mockRows {
	return &mockRows{rows: rows}
}

func newMockRowNoRows() *mockRow {
	return &mockRow{noRows: true}
}

func newMockRowErr(err error) *mockRow {
	return &mockRow{err: err}
}

// commandTag creates a pgconn.CommandTag with the given rows affected count.
func commandTag(rowsAffected int64) pgconn.CommandTag {
	return pgconn.NewCommandTag(fmt.Sprintf("UPDATE %d", rowsAffected))
}

// mockPresigner implements the Presigner interface with canned responses.
type mockPresigner struct {
	putURL string
	putErr error
	getURL string
	getErr error
}

func (m *mockPresigner) PresignedPutURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	return m.putURL, m.putErr
}

func (m *mockPresigner) PresignedGetURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	return m.getURL, m.getErr
}
