# Expo Router Path Resolution Issues - Complete Solution Guide

## Overview
This guide documents common path resolution issues when using Expo Router with TypeScript and provides comprehensive solutions to prevent and resolve them. The main culprit is often Babel configuration conflicts, not just path aliases.

## Common Issues Encountered

### 1. Babel Plugin Conflicts (Primary Issue)
**Error**: `Package subpath './babel-plugin' is not defined by "exports" in moti/package.json` or similar bundling failures.

**Root Cause**: Conflicting or incorrectly configured Babel plugins, particularly Moti and react-native-dotenv plugins.

### 2. Path Alias Resolution Problems
**Error**: `Cannot find module '@/stores/syncStore'` or similar path resolution errors.

**Root Cause**: Misconfiguration of path aliases between Metro bundler and TypeScript compiler.

### 3. Import Path Conflicts
**Error**: Components fail to resolve imports using `@/` aliases.

**Root Cause**: Inconsistent path alias configuration across different build tools.

## Complete Solution

### Step 1: Fix Babel Configuration (`babel.config.js`) - CRITICAL FIRST STEP

**This is the most important step and often the root cause of bundling failures.**

```javascript
module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Enable Hermes for better performance
          hermes: true,
          // Enable lazy imports for better bundle splitting
          lazyImports: true,
          // Disable native wind since you're using React Native Paper
          nativeWind: false,
        },
      ],
    ],
    plugins: [
      // React Native Paper babel plugin for tree shaking
      'react-native-paper/babel',

      // React Native Reanimated plugin (MUST be last)
      'react-native-reanimated/plugin',
    ],
    env: {
      production: {
        plugins: [
          // Production-only optimizations
          // Console removal is handled by Metro bundler in production
        ],
      },
      development: {
        plugins: [
          // Development-only plugins
          // React refresh is handled by Expo development server
        ],
      },
    },
  };
};
```

**Key Points**:
- **DO NOT** include `moti/babel-plugin` - it causes bundling failures
- **DO NOT** include `module:react-native-dotenv` - conflicts with Expo Router
- Keep `react-native-reanimated/plugin` as the **LAST** plugin
- Use `babel-preset-expo` with proper configuration

### Step 3: Configure Metro Bundler (`metro.config.js`)

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add path alias resolution
config.resolver.alias = {
  '@': path.resolve(__dirname, '.'),
};

module.exports = config;
```

**Key Points**:
- Use `path.resolve(__dirname, '.')` to point to project root
- This ensures Metro can resolve `@/` imports correctly
- Must be consistent with TypeScript configuration

### Step 4: Configure TypeScript (`tsconfig.json`)

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "module": "ESNext",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "paths": {
      "@/*": ["./*"]
    },
    "baseUrl": ".",
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
```

**Key Points**:
- `"@/*": ["./*"]` maps `@/` to project root
- `"baseUrl": "."` sets the base directory for path resolution
- Must match Metro configuration exactly

### Step 5: Alternative Solution - Use Relative Paths

When path aliases cause issues, use relative imports as a fallback:

```typescript
// Instead of:
import { useSyncStore } from '@/stores/syncStore';

// Use:
import { useSyncStore } from '../stores/syncStore';
```

**Benefits**:
- No configuration required
- Always works regardless of build tool settings
- More explicit about file relationships

### Step 6: Verify Configuration

1. **Check Metro Resolution**:
   ```bash
   npx expo start --clear
   ```

2. **Check TypeScript Compilation**:
   ```bash
   npx tsc --noEmit
   ```

3. **Test Imports**:
   - Try importing from different directories
   - Verify both absolute (`@/`) and relative paths work

## Best Practices

### 1. Consistent Path Strategy
- Choose either path aliases OR relative paths
- Don't mix both approaches in the same project
- Document your choice for team consistency

### 2. Directory Structure
```
mobile/
├── src/
│   ├── components/
│   ├── stores/
│   ├── services/
│   └── utils/
├── app/
│   ├── (tabs)/
│   └── (auth)/
└── hooks/
```

### 3. Import Patterns

**With Path Aliases**:
```typescript
import { useAuthStore } from '@/stores/authStore';
import { ThemedView } from '@/components/themed-view';
```

**With Relative Paths**:
```typescript
import { useAuthStore } from '../stores/authStore';
import { ThemedView } from '../components/themed-view';
```

## Troubleshooting

### Issue: Babel bundling failures (Moti, react-native-dotenv errors)
**Solution**: 
1. Remove problematic plugins from `babel.config.js`
2. Clear Metro cache: `npx expo start --clear`
3. Restart development server
4. Use the clean Babel configuration provided above

### Issue: "Cannot find module" errors persist
**Solution**: 
1. Clear Metro cache: `npx expo start --clear`
2. Restart TypeScript server in your IDE
3. Verify both Metro and TypeScript configs match

### Issue: Imports work in IDE but fail at runtime
**Solution**: 
1. Check Metro configuration
2. Ensure `metro.config.js` is in the correct location
3. Verify path resolution in Metro logs

### Issue: TypeScript errors but Metro works
**Solution**: 
1. Check `tsconfig.json` configuration
2. Ensure `baseUrl` and `paths` are correct
3. Restart TypeScript language server

## Prevention Strategies

### 1. Project Setup Checklist
- [ ] **FIRST**: Configure clean Babel configuration (most critical)
- [ ] Configure Metro bundler with path aliases
- [ ] Configure TypeScript with matching path aliases
- [ ] Test imports during initial setup
- [ ] Document path resolution strategy

### 2. Team Guidelines
- [ ] Establish consistent import patterns
- [ ] Use relative paths for local components
- [ ] Use path aliases for shared utilities
- [ ] Document any custom path configurations

### 3. CI/CD Considerations
- [ ] Test path resolution in build pipeline
- [ ] Verify configuration consistency across environments
- [ ] Include path resolution tests in automated checks

## Advanced Configuration

### Custom Path Aliases
```javascript
// metro.config.js
config.resolver.alias = {
  '@': path.resolve(__dirname, '.'),
  '@components': path.resolve(__dirname, 'src/components'),
  '@stores': path.resolve(__dirname, 'src/stores'),
  '@utils': path.resolve(__dirname, 'src/utils'),
};
```

```json
// tsconfig.json
"paths": {
  "@/*": ["./*"],
  "@components/*": ["./src/components/*"],
  "@stores/*": ["./src/stores/*"],
  "@utils/*": ["./src/utils/*"]
}
```

### Environment-Specific Paths
```javascript
// metro.config.js
const isDevelopment = process.env.NODE_ENV === 'development';

config.resolver.alias = {
  '@': path.resolve(__dirname, isDevelopment ? '.' : 'dist'),
};
```

## Conclusion

Path resolution issues in Expo Router projects are common but easily preventable with proper configuration. **The most critical step is fixing the Babel configuration first**, as this is often the root cause of bundling failures. Then maintain consistency between Metro bundler and TypeScript compiler configurations.

Remember:
- **Start with Babel configuration** - this is the most common cause of issues
- Configure Metro and TypeScript consistently
- Test imports during development
- Use relative paths when path aliases cause issues
- Document your path resolution strategy for team consistency
