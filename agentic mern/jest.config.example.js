/**
 * Jest Configuration for MERN Stack
 * Handles both server (Node.js) and client (React) testing
 */

module.exports = {
  projects: [
    // ==========================================
    // SERVER TESTS (Express/Node.js)
    // ==========================================
    {
      displayName: "server",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/server/**/__tests__/**/*.test.ts",
        "<rootDir>/server/**/__tests__/**/*.test.js",
        "<rootDir>/server/**/*.test.ts",
        "<rootDir>/server/**/*.test.js",
      ],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", {
          tsconfig: {
            jsx: "react",
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
          },
        }],
      },
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
      collectCoverageFrom: [
        "server/**/*.ts",
        "!server/**/*.test.ts",
        "!server/**/__tests__/**",
        "!server/**/dist/**",
        "!server/node_modules/**",
      ],
      coveragePathIgnorePatterns: [
        "/node_modules/",
        "/dist/",
      ],
      testTimeout: 10000,
      globals: {
        "ts-jest": {
          isolatedModules: true,
        },
      },
    },

    // ==========================================
    // CLIENT TESTS (React)
    // ==========================================
    {
      displayName: "client",
      testEnvironment: "jsdom",
      testMatch: [
        "<rootDir>/src/**/__tests__/**/*.test.tsx",
        "<rootDir>/src/**/__tests__/**/*.test.ts",
        "<rootDir>/src/**/*.test.tsx",
        "<rootDir>/src/**/*.test.ts",
      ],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", {
          tsconfig: {
            jsx: "react-jsx",
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
          },
        }],
      },
      moduleNameMapper: {
        // Handle CSS imports in React components
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
        
        // Handle image imports
        "\\.(jpg|jpeg|png|gif|svg)$": "<rootDir>/src/__mocks__/fileMock.js",
        
        // Handle module aliases (if you use them)
        "^@/(.*)$": "<rootDir>/src/$1",
        "^components/(.*)$": "<rootDir>/src/components/$1",
        "^hooks/(.*)$": "<rootDir>/src/hooks/$1",
        "^utils/(.*)$": "<rootDir>/src/utils/$1",
      },
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
      setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
      collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.test.{ts,tsx}",
        "!src/**/__tests__/**",
        "!src/index.tsx",
        "!src/reportWebVitals.ts",
      ],
      coveragePathIgnorePatterns: [
        "/node_modules/",
        "/dist/",
      ],
      testTimeout: 5000,
      globals: {
        "ts-jest": {
          isolatedModules: true,
        },
      },
    },
  ],

  // ==========================================
  // GLOBAL SETTINGS
  // ==========================================
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "server/**/*.ts",
    "src/**/*.tsx",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/.next/**",
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  // Reporters
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "./test-results",
        outputName: "junit.xml",
        classNameTemplate: "{classname}",
        titleTemplate: "{title}",
        ancestorSeparator: " › ",
      },
    ],
  ],

  // Watch plugins
  watchPlugins: [
    "jest-watch-typeahead/filename",
    "jest-watch-typeahead/testname",
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/.next/",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!(some-esm-module)/)",
  ],

  // Module resolution
  moduleDirectories: ["node_modules", "<rootDir>"],
  rootDir: ".",

  // Verbose output
  verbose: true,
  bail: 1,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
