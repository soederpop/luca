/**
 * An error carrying an HTTP status code. Endpoint handlers (and anything they
 * call) can throw this to control the response status instead of falling into
 * the generic 500 path.
 *
 * @example
 * ```typescript
 * throw new HttpError(413, 'File exceeds the 25mb limit')
 * ```
 */
export class HttpError extends Error {
  statusCode: number
  details?: any

  constructor(statusCode: number, message: string, details?: any) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.details = details
  }
}

export default HttpError
