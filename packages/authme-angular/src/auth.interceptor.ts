/**
 * Angular HTTP interceptor that adds the Bearer token to outgoing requests.
 *
 * @example
 * ```typescript
 * // app.config.ts  (Angular 15+ standalone)
 * import { provideHttpClient, withInterceptors } from '@angular/common/http';
 * import { authInterceptor } from '@authme/angular';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideHttpClient(withInterceptors([authInterceptor])),
 *   ],
 * };
 * ```
 *
 * Or with the class-based interceptor (NgModule style):
 * ```typescript
 * @NgModule({
 *   providers: [
 *     { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
 *   ],
 * })
 * ```
 */

import { Injectable } from '@angular/core';
import type {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptorFn,
} from '@angular/common/http';
import type { Observable } from 'rxjs';
import { inject } from '@angular/core';
import { AuthService } from './auth.service.js';

/**
 * Class-based HTTP interceptor (NgModule-compatible).
 * Attaches the current AuthMe access token as a `Authorization: Bearer ...`
 * header when one is available.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private readonly auth: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.auth.getToken();
    if (!token) {
      return next.handle(req);
    }

    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next.handle(authReq);
  }
}

/**
 * Functional HTTP interceptor for use with `provideHttpClient(withInterceptors([...]))`.
 * (Angular 15+)
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (!token) return next(req);

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
