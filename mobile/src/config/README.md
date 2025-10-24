# Configuration

## API Configuration

The API URL is configured in `src/config/api.ts` and can be overridden using environment variables.

### Environment Variables

Create a `.env` file in the mobile directory with:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### Default Configuration

- **Base URL**: `http://localhost:3000` (default)
- **Timeout**: 10000ms
- **Retry Attempts**: 3

### Usage

```typescript
import { API_CONFIG } from '../config/api';

// Use the configured base URL
const syncService = new SyncService(API_CONFIG.BASE_URL);
```

### Environment-Specific Configuration

- **Development**: `http://localhost:3000`
- **Staging**: `https://api-staging.handeepos.com`
- **Production**: `https://api.handeepos.com`
