import { Injectable } from '@nestjs/common';
import { isPersistentStorage } from './common/uploads';

@Injectable()
export class AppService {
  /**
   * `storage` says where uploads live: "r2" survives a deploy, "local" is wiped by the next one.
   * It tells whether the R2 variables are set on the host without reading its logs, and gives
   * nothing away: no bucket name, account or key.
   */
  getHealth() {
    return {
      status: 'ok',
      service: 'growth-backend',
      storage: isPersistentStorage() ? 'r2' : 'local',
    };
  }
}
