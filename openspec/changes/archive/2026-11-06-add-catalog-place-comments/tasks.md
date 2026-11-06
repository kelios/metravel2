## 1. Client and presentation

- [x] 1.1 Add the typed API, lazy query, pagination, writes and safety integration.
- [x] 1.2 Add the catalog discussion action, shared dialog, plain text composer and current locale strings.
- [x] 1.3 Cover guest/auth, draft retry, stable identity, no eager request and moderation with targeted regressions.

## 2. Delivery

- [x] 2.1 Complete code review and the board review/push gate.
- [x] 2.2 Verify the live endpoint and mobile/desktop user flows after the backend and frontend deploys.

Production accepted on `b682cd97a59040ddd08ca5d9161e1b1b8bf12f96`: guest lazy read, keyboard focus/escape, authenticated POST 201 and DELETE 204 with confirmed cleanup, same discussion across articles, accessible error and successful retry. Cursor paging covered by automated tests.
