import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;
  readonly authLoginTotal: Counter;
  readonly authTokenIssuedTotal: Counter;
  readonly activeSessionsTotal: Gauge;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.authLoginTotal = new Counter({
      name: 'auth_login_total',
      help: 'Total number of login attempts',
      labelNames: ['realm', 'status'],
      registers: [this.registry],
    });

    this.authTokenIssuedTotal = new Counter({
      name: 'auth_token_issued_total',
      help: 'Total number of tokens issued',
      labelNames: ['realm', 'grant_type'],
      registers: [this.registry],
    });

    this.activeSessionsTotal = new Gauge({
      name: 'active_sessions_total',
      help: 'Number of active sessions',
      labelNames: ['realm'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }
}
