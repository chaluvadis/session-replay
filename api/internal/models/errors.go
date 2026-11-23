package models

// ApiError represents a standardized API error response.
//
// All API errors use the format:
//   { "error": { "code": "...", "message": "..." } }
type ApiError struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail contains the structured error information.
type ErrorDetail struct {
	// Code is a machine-readable error code.
	Code string `json:"code"`

	// Message is a human-readable error message.
	Message string `json:"message"`

	// Details holds optional additional error information.
	Details any `json:"details,omitempty"`
}

// NewApiError constructs an ApiError from a code and message.
func NewApiError(code, message string) ApiError {
	return ApiError{
		Error: ErrorDetail{
			Code:    code,
			Message: message,
		},
	}
}

// NewApiErrorWithDetails constructs an ApiError with additional details.
func NewApiErrorWithDetails(code, message string, details any) ApiError {
	return ApiError{
		Error: ErrorDetail{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
}
