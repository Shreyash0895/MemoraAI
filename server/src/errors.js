/** An error that is safe to show to the caller (becomes a JSON response). */
export class HttpError extends Error {
  constructor(status, message, code = "invalid") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
