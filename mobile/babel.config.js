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
  