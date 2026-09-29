import { isElasticsearchConfigured } from '../../config/env';

/**
 * Elasticsearch indexing/search foundation (Phase 3 / TODO).
 *
 * In Phase 1 search runs against PostgreSQL (see search.service.ts) and returns
 * the same response shape, so this can be swapped in later without UI changes.
 */
export class ElasticsearchService {
  isReady(): boolean {
    return isElasticsearchConfigured();
  }

  // TODO (Phase 3): index an email job document.
  async index(_id: string, _doc: Record<string, unknown>): Promise<void> {
    if (!this.isReady()) return;
  }

  // TODO (Phase 3): full-text search backed by Elasticsearch.
  async search(_userId: string, _query: string): Promise<null> {
    return null;
  }
}

export const elasticsearchService = new ElasticsearchService();
