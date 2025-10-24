import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed';

export default class SyncQueue extends Model {
  static table = 'sync_queue';

  @field('operation') operation!: SyncOperation;
  @field('collection') collectionName!: string;
  @field('document_id') documentId!: string;
  @field('data') data!: string; // JSON string
  @field('status') status!: SyncStatus;
  @field('retry_count') retryCount!: number;
  @field('error_message') errorMessage?: string;
  @readonly @date('timestamp') timestamp!: Date;

  // Helper methods

  get syncData(): any {
    try {
      return JSON.parse(this.data);
    } catch {
      return null;
    }
  }

  set syncData(data: any) {
    this.data = JSON.stringify(data);
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isSyncing(): boolean {
    return this.status === 'syncing';
  }

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get isFailed(): boolean {
    return this.status === 'failed';
  }

  get canRetry(): boolean {
    return this.isFailed && this.retryCount < 3;
  }
}
