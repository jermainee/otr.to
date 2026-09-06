module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        // Styles are only pulled in by the webpack build, not by the components under test.
        '\\.(css|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.ts',
        // peerjs would try to reach a signalling server on construction.
        '^peerjs$': '<rootDir>/src/__mocks__/peerjs.ts',
    },
};
