module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    transform: {
        // tsconfig.json emits ES modules for webpack; jest runs CommonJS.
        '^.+\\.tsx?$': ['ts-jest', {tsconfig: {module: 'commonjs', moduleResolution: 'node10'}}],
    },
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/__mocks__/**',
        '!src/testUtils/**',
    ],
    moduleNameMapper: {
        // Styles are only pulled in by the webpack build, not by the components under test.
        '\\.(css|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.ts',
        // peerjs would try to reach a signalling server on construction.
        '^peerjs$': '<rootDir>/src/__mocks__/peerjs.ts',
    },
};
