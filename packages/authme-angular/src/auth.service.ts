/**
 * AuthService — injectable Angular service that wraps `AuthmeClient`.
 *
 * Provides reactive auth state as RxJS observables and exposes the full
 * `AuthmeClient` API.
 *
 * @example
 * ```typescript
 * @Component({ ... })
 * export class NavComponent {
 *   constructor(public auth: AuthService) {}
 * }
 * ```
 *
 * ```html
 * <button *ngIf="auth.isAuthenticated$ | async" (click)="auth.logout()">
 *   Sign out
 * </button>
 * ```
 */

import { Injectable, Inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthmeClient } from 'authme-sdk';
import type { UserInfo, AuthmeConfig, TokenResponse } from 'authme-sdk';
import { AUTHME_CONFIG } from './auth.config.js';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  /** The underlying AuthmeClient instance. */
  readonly client: AuthmeClient;

  // ── Reactive state ──────────────────────────────────────────────

  private readonly _isAuthenticated$ = new BehaviorSubject<boolean>(false);
  private readonly _isLoading$ = new BehaviorSubject<boolean>(true);
  private readonly _user$ = new BehaviorSubject<UserInfo | null>(null);

  /** Observable of whether the user is authenticated. */
  readonly isAuthenticated$: Observable<boolean> =
    this._isAuthenticated$.asObservable();

  /** Observable of whether the auth client is still initializing. */
  readonly isLoading$: Observable<boolean> = this._isLoading$.asObservable();

  /** Observable of the current user info. */
  readonly user$: Observable<UserInfo | null> = this._user$.asObservable();

  // ── Unsubscribe handles ─────────────────────────────────────────

  private readonly _unsubscribers: Array<() => void> = [];

  constructor(@Inject(AUTHME_CONFIG) config: AuthmeConfig) {
    this.client = new AuthmeClient(config);
    this._wireEvents();
    this._initialize();
  }

  // ── Synchronous getters ─────────────────────────────────────────

  /** Current synchronous authentication state. */
  get isAuthenticated(): boolean {
    return this._isAuthenticated$.value;
  }

  /** Current synchronous loading state. */
  get isLoading(): boolean {
    return this._isLoading$.value;
  }

  /** Current synchronous user info. */
  get user(): UserInfo | null {
    return this._user$.value;
  }

  // ── Auth actions ────────────────────────────────────────────────

  /** Redirect to the AuthMe login page. */
  async login(options?: { scope?: string[] }): Promise<void> {
    return this.client.login(options);
  }

  /** Log out and clear tokens. */
  async logout(): Promise<void> {
    return this.client.logout();
  }

  /** Get the current access token string. */
  getToken(): string | null {
    return this.client.getAccessToken();
  }

  /** Handle the OIDC callback after redirect. */
  async handleCallback(url?: string): Promise<boolean> {
    return this.client.handleCallback(url);
  }

  /** Check if the user has a specific realm role. */
  hasRole(role: string): boolean {
    return this.client.hasRealmRole(role);
  }

  /** Check if the user has a specific permission. */
  hasPermission(permission: string): boolean {
    return this.client.hasPermission(permission);
  }

  /** Get all realm roles for the current user. */
  getRoles(): string[] {
    return this.client.getRealmRoles();
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  ngOnDestroy(): void {
    this._unsubscribers.forEach((unsub) => unsub());
    this._unsubscribers.length = 0;
  }

  // ── Internal ────────────────────────────────────────────────────

  private _wireEvents(): void {
    this._unsubscribers.push(
      this.client.on('login', (_tokens: TokenResponse) => {
        this._isAuthenticated$.next(true);
        this._user$.next(this.client.getUserInfo());
      }),
      this.client.on('logout', () => {
        this._isAuthenticated$.next(false);
        this._user$.next(null);
      }),
      this.client.on('tokenRefresh', (_tokens: TokenResponse) => {
        this._user$.next(this.client.getUserInfo());
      }),
    );
  }

  private async _initialize(): Promise<void> {
    try {
      // Handle OIDC callback if URL has `code` param
      if (typeof window !== 'undefined') {
        const params = new URL(window.location.href).searchParams;
        if (params.has('code') && params.has('state')) {
          const success = await this.client.handleCallback();
          this._isAuthenticated$.next(success);
          if (success) this._user$.next(this.client.getUserInfo());
          this._isLoading$.next(false);
          return;
        }
      }

      const restored = await this.client.init();
      this._isAuthenticated$.next(restored);
      if (restored) this._user$.next(this.client.getUserInfo());
    } catch {
      this._isAuthenticated$.next(false);
    } finally {
      this._isLoading$.next(false);
    }
  }
}
