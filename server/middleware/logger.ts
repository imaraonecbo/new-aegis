export interface LogEntry {
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY' | 'AUDIT';
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  userId?: string;
  ip?: string;
  requestId?: string;
}

class EnterpriseLogger {
  private formatLog(entry: LogEntry): string {
    return JSON.stringify({
      app: 'AegisQuant',
      version: '1.0.0-PROD',
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    });
  }

  info(message: string, context?: Record<string, any>) {
    console.log(this.formatLog({ level: 'INFO', message, timestamp: new Date().toISOString(), context }));
  }

  warn(message: string, context?: Record<string, any>) {
    console.warn(this.formatLog({ level: 'WARN', message, timestamp: new Date().toISOString(), context }));
  }

  error(message: string, error?: any, context?: Record<string, any>) {
    console.error(this.formatLog({
      level: 'ERROR',
      message,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }));
  }

  security(message: string, context?: Record<string, any>) {
    console.warn(this.formatLog({ level: 'SECURITY', message, timestamp: new Date().toISOString(), context }));
  }

  audit(message: string, context?: Record<string, any>) {
    console.log(this.formatLog({ level: 'AUDIT', message, timestamp: new Date().toISOString(), context }));
  }
}

export const logger = new EnterpriseLogger();
