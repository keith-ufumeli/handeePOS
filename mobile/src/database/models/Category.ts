import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class Category extends Model {
  static table = 'categories';

  @field('name') name!: string;
  @field('description') description?: string;
  @field('is_active') isActive!: boolean;
  @field('sync_status') syncStatus!: string;
  @field('last_synced_at') lastSyncedAt?: number;
  @field('server_id') serverId?: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
