## Purpose

Серверный рендер страницы восстанавливает безопасное чтение API после закрытия старого соединения, сохраняя исходный дедлайн и явный отказ при настоящем сбое.

## ADDED Requirements

### Requirement: Bounded recovery of a retired connection

The SSR API GET transport SHALL retry at most once on a fresh connection when a reused connection is reset before any response starts, preserving the original cancellation signal and 10-second deadline.

#### Scenario: Reused connection resets
- **WHEN** a GET on a reused connection resets before a response and the request remains active
- **THEN** one attempt on a fresh connection returns the successful API result with the original guest headers

#### Scenario: Recovery also fails
- **WHEN** the recovery attempt resets
- **THEN** the transport fails without a third attempt

### Requirement: Genuine failures remain visible

The transport MUST NOT retry fresh-connection failures, other network errors, HTTP error statuses, body failures, invalid JSON, oversized bodies, or cancellation. Recovery MUST NOT extend the original deadline or follow redirects.

#### Scenario: Partial body resets
- **WHEN** a reused connection resets after response headers
- **THEN** the transport fails without repeating the GET

#### Scenario: Deadline or caller cancellation
- **WHEN** the original signal aborts during recovery
- **THEN** the operation aborts without another attempt or a new timeout budget

#### Scenario: Upstream response is an error
- **WHEN** the API returns 404, 410, 503, a redirect, or invalid JSON
- **THEN** existing response and error behavior is preserved without another attempt
