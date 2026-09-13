export class AppMetrics {
  public messages_received_total = 0;
  public messages_processed_total = 0;
  public ai_requests_total = 0;
  public ai_errors_total = 0;
  public tool_executions_total = 0;
  public queue_jobs_total = 0;

  getSnapshot() {
    return {
      messages_received_total: this.messages_received_total,
      messages_processed_total: this.messages_processed_total,
      ai_requests_total: this.ai_requests_total,
      ai_errors_total: this.ai_errors_total,
      tool_executions_total: this.tool_executions_total,
      queue_jobs_total: this.queue_jobs_total,
    };
  }
}

export const metrics = new AppMetrics();
